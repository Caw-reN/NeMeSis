<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceLog;
use App\Services\CiscoSshService;
use App\Services\MikrotikService;
use App\Services\DeviceCredentialService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DeviceConfigController extends Controller
{
    public function __construct(
        private readonly DeviceCredentialService $credentialService
    ) {}

    public function togglePort(Request $request, Device $device)
    {
        $request->validate([
            'interface' => 'required|string',
            'enable'    => 'required|boolean',
        ]);

        $interface = $request->input('interface');
        $enable    = $request->input('enable');
        $stateStr  = $enable ? 'enabled' : 'disabled';

        try {
            $this->executeAction($device, function ($service) use ($interface, $enable) {
                $service->setPortState($interface, $enable);
            });

            // Log the action
            $this->logAction($device, "Port {$interface} was {$stateStr} remotely.", 'config_change');

            return response()->json(['message' => "Port {$interface} successfully {$stateStr}."]);
        } catch (\Exception $e) {
            Log::error("Failed to toggle port on device {$device->id}: " . $e->getMessage());
            return response()->json(['message' => 'Failed to toggle port: ' . $e->getMessage()], 500);
        }
    }

    public function changeVlan(Request $request, Device $device)
    {
        if ($device->vendor !== 'cisco') {
            return response()->json(['message' => 'VLAN/Mode configuration is only supported for Cisco devices.'], 400);
        }

        $request->validate([
            'interface' => 'required|string',
            'mode'      => 'required|string|in:access,trunk',
            'vlan_id'   => 'nullable|integer|min:1|max:4094',
        ]);

        $interface = $request->input('interface');
        $mode      = $request->input('mode');
        $vlanId    = $request->input('vlan_id');

        try {
            $this->executeAction($device, function ($service) use ($interface, $mode, $vlanId) {
                if (method_exists($service, 'setPortMode')) {
                    $service->setPortMode($interface, $mode, $vlanId);
                } else {
                    throw new \RuntimeException("Method setPortMode not implemented on this service.");
                }
            });

            // Log the action
            $logMsg = $mode === 'trunk' 
                ? "Port {$interface} changed to Trunk mode."
                : "Port {$interface} changed to Access mode (VLAN {$vlanId}).";
            $this->logAction($device, $logMsg, 'config_change');

            return response()->json(['message' => $logMsg]);
        } catch (\Exception $e) {
            Log::error("Failed to change port mode on device {$device->id}: " . $e->getMessage());
            return response()->json(['message' => 'Failed to change port configuration: ' . $e->getMessage()], 500);
        }
    }

    public function reboot(Request $request, Device $device)
    {
        try {
            $this->executeAction($device, function ($service) {
                $service->reboot();
            });

            $this->logAction($device, "Remote reboot initiated.", 'system');

            return response()->json(['message' => 'Device is rebooting.']);
        } catch (\Exception $e) {
            Log::error("Failed to reboot device {$device->id}: " . $e->getMessage());
            return response()->json(['message' => 'Failed to reboot device: ' . $e->getMessage()], 500);
        }
    }

    public function executeTerminal(Request $request, Device $device)
    {
        $request->validate([
            'command' => 'required|string',
        ]);

        $command = trim($request->input('command'));

        try {
            $output = $this->executeAction($device, function ($service) use ($command) {
                return $service->executeTerminalCommand($command);
            });

            $this->logAction($device, "Executed remote command: {$command}", 'config_change');

            return response()->json(['output' => $output]);
        } catch (\Exception $e) {
            Log::error("Terminal command failed on device {$device->id}: " . $e->getMessage());
            return response()->json(['message' => 'Command failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Helper to initialize the correct service and execute the callback.
     */
    private function executeAction(Device $device, callable $callback)
    {
        if ($device->vendor === 'cisco') {
            $creds = $this->credentialService->getCiscoCredentials($device);
            if (!$creds || empty($creds['ssh_user'])) {
                throw new \RuntimeException('No SSH credentials found for this device.');
            }

            $service = new CiscoSshService($device->ip_address, $creds['ssh_port'] ?? 22, 10);
            $service->connect($creds['ssh_user'], $creds['ssh_pass'] ?? '', $creds['enable_pass'] ?? '');
            
            try {
                return $callback($service);
            } finally {
                $service->disconnect();
            }
        } elseif ($device->vendor === 'mikrotik') {
            $creds = $this->credentialService->getMikrotikCredentials($device);
            if (!$creds || empty($creds['api_user'])) {
                throw new \RuntimeException('No API credentials found for this device.');
            }

            $service = new MikrotikService($device->ip_address, $creds['api_port'] ?? 8728, 5);
            $service->connect($creds['api_user'], $creds['api_pass'] ?? '');
            
            try {
                return $callback($service);
            } finally {
                $service->disconnect();
            }
        } else {
            throw new \RuntimeException("Remote configuration is not supported for vendor: {$device->vendor}");
        }
    }

    private function logAction(Device $device, string $message, string $type)
    {
        DeviceLog::create([
            'device_id'  => $device->id,
            'user_id'    => auth()->id() ?? 1, // Fallback if auth is not fully mocked
            'event_type' => $type,
            'message'    => $message,
        ]);
    }
}
