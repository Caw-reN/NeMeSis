<?php

namespace App\Traits;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

trait ProcessesIconUploads
{
    /**
     * Process icon upload, optionally removing background using python script
     * 
     * @param UploadedFile $file
     * @return string
     */
    protected function processIconUpload(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if ($extension === 'svg') {
            return file_get_contents($file->getRealPath());
        }

        $tempInput = $file->getRealPath();
        
        if ($extension === 'png') {
            $base64 = base64_encode(file_get_contents($tempInput));
            $mime = $file->getClientMimeType();
            $dimensions = getimagesize($tempInput);
        } else {
            $tempOutput = tempnam(sys_get_temp_dir(), 'icon_bg_') . '.png';
            
            $scriptPath = base_path('scripts/remove_bg.py');
            $pythonBin = file_exists('/opt/venv/bin/python') ? '/opt/venv/bin/python' : 'python';
            $cmd = "ORT_DISABLE_THREAD_AFFINITY=1 " . escapeshellcmd($pythonBin) . " " . escapeshellarg($scriptPath) . " " . escapeshellarg($tempInput) . " " . escapeshellarg($tempOutput) . " 2>&1";
            
            $output = shell_exec($cmd);
            Log::info("rembg output: " . $output);

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
