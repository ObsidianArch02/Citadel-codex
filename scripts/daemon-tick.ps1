# daemon-tick.ps1 — Citadel daemon factory loop.
#
# Run in a PowerShell window. Leave it open. Each session starts the moment
# the previous one finishes plus 60 seconds of cooldown. The loop stops when
# the daemon stops itself (campaign complete, budget hit, level-up pending).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File C:\Users\gammo\Desktop\Citadel\scripts\daemon-tick.ps1
#
# Runtime command:
#   Set CITADEL_DAEMON_COMMAND to a Codex CLI command template containing `{prompt}`.
#   Example:
#     $env:CITADEL_DAEMON_COMMAND = "codex exec {prompt}"
#
# To stop manually: close the window or Ctrl+C.

$citadel = "C:\Users\gammo\Desktop\Citadel"
$logFile = "$citadel\.planning\daemon-runs.log"
$daemonCommand = $env:CITADEL_DAEMON_COMMAND

if ([string]::IsNullOrWhiteSpace($daemonCommand)) {
    Write-Host "CITADEL_DAEMON_COMMAND is not set. Exiting."
    Write-Host "Set it to a Codex command template, for example: codex exec {prompt}"
    exit 1
}

if ($daemonCommand -notmatch "codex") {
    Write-Host "CITADEL_DAEMON_COMMAND must invoke Codex. Exiting."
    exit 1
}

while ($true) {
    # Check if daemon is still running
    $daemonPath = "$citadel\.planning\daemon.json"
    if (-not (Test-Path $daemonPath)) {
        Write-Host "No daemon.json found. Exiting."
        break
    }

    $daemon = Get-Content $daemonPath -Raw | ConvertFrom-Json
    if ($daemon.status -ne "running") {
        Write-Host "Daemon stopped: $($daemon.stopReason)"
        break
    }

    # Run one session
    Write-Host "$(Get-Date) - Starting session $($daemon.sessionCount + 1)"
    $prompt = "/do continue"
    $escapedPrompt = '"' + ($prompt -replace '"', '\"') + '"'
    $commandToRun = $daemonCommand -replace "\{prompt\}", $escapedPrompt
    if ($commandToRun -eq $daemonCommand) {
        $commandToRun = "$daemonCommand $escapedPrompt"
    }
    Invoke-Expression $commandToRun 2>&1 | Tee-Object -Append $logFile

    # Cooldown before next session
    Write-Host "$(Get-Date) - Session complete. Cooling down 60s..."
    Start-Sleep -Seconds 60
}

Write-Host "Factory stopped at $(Get-Date)"
