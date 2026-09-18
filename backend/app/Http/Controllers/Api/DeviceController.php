<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeviceRequest;
use App\Http\Requests\UpdateDeviceRequest;
use App\Http\Resources\DeviceLogResource;
use App\Http\Resources\DeviceResource;
use App\Models\Device;
use App\Models\DeviceLog;
use App\Services\CiscoSshService;
use App\Services\DeviceCredentialService;
use App\Services\MikrotikService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DeviceController extends Controller
{
    /**
     * GET /api/devices
     * List all devices with optional filtering.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $devices = Device::query()
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->vendor, fn ($q, $v) => $q->where('vendor', $v))
            ->when($request->type,   fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) =>
                $q->where(fn ($sub) =>
                    $sub->where('name', 'like', "%{$s}%")
                        ->orWhere('ip_address', 'like', "%{$s}%")
                        ->orWhere('location', 'like', "%{$s}%")
                )
            )
            ->oldest()
            ->paginate($request->per_page ?? 20);

        return DeviceResource::collection($devices);
    }

    /**
     * POST /api/devices
     * Create a new device.
     */
    public function store(StoreDeviceRequest $request): JsonResponse
    {
        $data = $request->validated();

        if ($request->hasFile('icon_file')) {
            $data['icon_svg'] = $this->processIconUpload($request->file('icon_file'));
        }

        // Extract credentials before passing to model
        // The Device model's setCredentialsAttribute will handle encryption
        $device = Device::create($data);

        DeviceLog::system(
            $device->id,
            'discovery',
            "Device '{$device->name}' ({$device->ip_address}) ditambahkan secara manual.",
            ['added_by_user_id' => $request->user()->id]
        );

        return response()->json(new DeviceResource($device), 201);
    }

    /**
     * GET /api/devices/{device}
     * Show a single device with its recent logs.
     */
    public function show(Device $device): JsonResponse
    {
        $device->load(['scanResults' => fn ($q) => $q->where('state', 'open')->orderBy('port')]);

        return response()->json([
            'device'       => new DeviceResource($device),
            'open_ports'   => $device->scanResults->map(fn ($r) => [
                'port'         => $r->port,
                'protocol'     => $r->protocol,
                'service_name' => $r->service_name,
                'is_dangerous' => $r->is_dangerous,
                'scanned_at'   => $r->scanned_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * PUT /api/devices/{device}
     * Update device details.
     */
    public function update(UpdateDeviceRequest $request, Device $device): JsonResponse
    {
        $data = $request->validated();

        if ($request->hasFile('icon_file')) {
            $data['icon_svg'] = $this->processIconUpload($request->file('icon_file'));
        }

        $device->update($data);

        DeviceLog::create([
            'device_id'  => $device->id,
            'user_id'    => $request->user()->id,
            'event_type' => 'config_change',
            'message'    => "Konfigurasi device diperbarui oleh {$request->user()->name}.",
            'metadata'   => ['updated_fields' => array_keys($request->validated())],
        ]);

        return response()->json(new DeviceResource($device->fresh()));
    }

    /**
     * DELETE /api/devices/{device}
     * Remove a device.
     */
    public function destroy(Request $request, Device $device): JsonResponse
    {
        $deviceName = $device->name;
        $deviceIp   = $device->ip_address;

        $device->delete();

        return response()->json([
            'message' => "Device '{$deviceName}' ({$deviceIp}) berhasil dihapus.",
        ]);
    }

    /**
     * DELETE /api/devices/bulk
     * Remove multiple devices.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $request->validate([
            'ids'   => ['required', 'array'],
            'ids.*' => ['integer', 'exists:devices,id'],
        ]);

        $count = Device::whereIn('id', $request->ids)->delete();

        return response()->json([
            'message' => "Berhasil menghapus {$count} perangkat.",
        ]);
    }

    /**
     * GET /api/devices/{device}/logs
     * Get paginated logs for a device.
     */
    public function logs(Request $request, Device $device): AnonymousResourceCollection
    {
        $logs = $device->logs()
            ->with('user')
            ->when($request->event_type, fn ($q, $t) => $q->where('event_type', $t))
            ->latest()
            ->paginate($request->per_page ?? 50);

        return DeviceLogResource::collection($logs);
    }

    /**
     * GET /api/devices/{device}/interfaces
     *
     * Fetch the real network interface list from the device.
     * - Mikrotik: uses RouterOS API (/interface/print)
     * - Cisco:    uses SSH (show interfaces status)
     * - Generic:  returns common eth names as fallback
     *
     * Returns: [ { name, type, status, mac, running } ]
     */
    public function interfaces(Device $device, DeviceCredentialService $credService): JsonResponse
    {
        try {
            $ifaces = match ($device->vendor) {
                'mikrotik' => $this->getMikrotikInterfaces($device, $credService),
                'cisco'    => $this->getCiscoInterfaces($device, $credService),
                default    => $this->getGenericInterfaces($device),
            };
        } catch (\Throwable $e) {
            // If we can't reach the device, return generic fallback
            $ifaces = $this->getGenericInterfaces($device);
        }

        return response()->json(['interfaces' => $ifaces]);
    }

    private function getMikrotikInterfaces(Device $device, DeviceCredentialService $credService): array
    {
        $creds = $credService->getMikrotikCredentials($device);
        if (!$creds) {
            return $this->getGenericInterfaces($device);
        }

        $svc = new MikrotikService($device->ip_address, $creds['api_port']);
        $svc->connect($creds['api_user'], $creds['api_pass']);

        try {
            $rows = $svc->getInterfaces();
        } finally {
            $svc->disconnect();
        }

        return array_map(fn ($r) => [
            'name'    => $r['name']    ?? '',
            'type'    => $r['type']    ?? 'ether',
            'status'  => isset($r['running']) && $r['running'] === 'true' ? 'up' : 'down',
            'mac'     => $r['mac-address'] ?? null,
            'running' => ($r['running'] ?? 'false') === 'true',
        ], array_filter($rows, fn ($r) => !empty($r['name'])));
    }

    private function getCiscoInterfaces(Device $device, DeviceCredentialService $credService): array
    {
        $creds = $credService->getCiscoCredentials($device);
        if (!$creds) {
            return $this->getGenericInterfaces($device);
        }

        $svc = new CiscoSshService($device->ip_address, $creds['ssh_port']);
        $svc->connect($creds['ssh_user'], $creds['ssh_pass'], $creds['enable_pass']);

        try {
            $rows = $svc->getInterfaceStatus();
        } finally {
            $svc->disconnect();
        }

        return array_map(fn ($r) => [
            'name'    => $r['port']   ?? $r['interface'] ?? '',
            'type'    => 'ether',
            'status'  => strtolower($r['status'] ?? '') === 'connected' ? 'up' : 'down',
            'mac'     => null,
            'running' => strtolower($r['status'] ?? '') === 'connected',
        ], array_filter($rows, fn ($r) => !empty($r['port'] ?? $r['interface'] ?? '')));
    }

    /**
     * Generic fallback: produce common interface names based on device type.
     */
    private function getGenericInterfaces(Device $device): array
    {
        $names = match ($device->type) {
            'router'  => ['eth0', 'eth1', 'eth2', 'eth3', 'eth4', 'wan0', 'lo'],
            'switch'  => ['eth0', 'eth1', 'eth2', 'eth3', 'eth4', 'eth5', 'eth6', 'eth7'],
            'server'  => ['eth0', 'eth1', 'lo'],
            'ap'      => ['eth0', 'wlan0', 'wlan1'],
            default   => ['eth0', 'eth1', 'eth2'],
        };

        return array_map(fn ($n) => [
            'name'    => $n,
            'type'    => str_starts_with($n, 'wlan') ? 'wireless' : 'ether',
            'status'  => 'unknown',
            'mac'     => null,
            'running' => null,
        ], $names);
    }

    /**
     * Process icon upload, optionally removing background using python script
     */
    protected function processIconUpload($file): string
    {
        if ($file->getClientOriginalExtension() === 'svg') {
            return file_get_contents($file->getRealPath());
        }

        $tempInput = $file->getRealPath();
        $tempOutput = tempnam(sys_get_temp_dir(), 'icon_bg_') . '.png';
        
        $scriptPath = base_path('scripts/remove_bg.py');
        $pythonBin = file_exists('/opt/venv/bin/python') ? '/opt/venv/bin/python' : 'python';
        $cmd = escapeshellcmd($pythonBin) . " " . escapeshellarg($scriptPath) . " " . escapeshellarg($tempInput) . " " . escapeshellarg($tempOutput) . " 2>&1";
        
        $output = shell_exec($cmd);
        \Illuminate\Support\Facades\Log::info("rembg output: " . $output);

        if (file_exists($tempOutput) && filesize($tempOutput) > 0) {
            $base64 = base64_encode(file_get_contents($tempOutput));
            $mime = 'image/png';
            $dimensions = getimagesize($tempOutput);
            @unlink($tempOutput);
        } else {
            // Fallback to original if processing fails
            $base64 = base64_encode(file_get_contents($tempInput));
            $mime = $file->getClientMimeType();
            $dimensions = getimagesize($tempInput);
        }

        $imgWidth = 24;
        $xOffset = 0;
        if ($dimensions && $dimensions[1] > 0) {
            $imgWidth = 24 * ($dimensions[0] / $dimensions[1]);
            if ($imgWidth > 75) {
                $imgWidth = 75;
            }
            $xOffset = 12 - ($imgWidth / 2);
        }

        return "<image href=\"data:{$mime};base64,{$base64}\" x=\"{$xOffset}\" y=\"0\" width=\"{$imgWidth}\" height=\"24\" />";
    }
}
