$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Frontend = Join-Path $Root "frontend"
$Logs = Join-Path $Root "logs"
$BackendOut = Join-Path $Logs "backend.out.log"
$BackendErr = Join-Path $Logs "backend.err.log"
$FrontendOut = Join-Path $Logs "frontend.out.log"
$FrontendErr = Join-Path $Logs "frontend.err.log"

function Test-LocalPort {
    param([int]$Port)

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $connected = $result.AsyncWaitHandle.WaitOne(600, $false)
        if ($connected) {
            $client.EndConnect($result)
            return $true
        }
        return $false
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-ForPort {
    param(
        [int]$Port,
        [string]$Name
    )

    for ($index = 0; $index -lt 30; $index++) {
        if (Test-LocalPort -Port $Port) {
            Write-Host "$Name is ready on port $Port."
            return
        }
        Start-Sleep -Milliseconds 500
    }

    Write-Host "$Name did not respond yet. Check the logs below."
}

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Missing .venv. Create a Python virtual environment and install requirements.txt."
}

if (-not (Test-Path -LiteralPath (Join-Path $Frontend "node_modules"))) {
    throw "Missing frontend dependencies. Run npm install inside frontend."
}

$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

Write-Host ""
Write-Host "Starting AI Travel Stylist..."
Write-Host ""

if (Test-LocalPort -Port 5000) {
    Write-Host "Flask API is already running on port 5000."
} else {
    Start-Process `
        -FilePath $Python `
        -ArgumentList "backend\app.py" `
        -WorkingDirectory $Root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $BackendOut `
        -RedirectStandardError $BackendErr

    Wait-ForPort -Port 5000 -Name "Flask API"
}

if (Test-LocalPort -Port 3000) {
    Write-Host "Next.js frontend is already running on port 3000."
} else {
    Start-Process `
        -FilePath $Npm `
        -ArgumentList "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000" `
        -WorkingDirectory $Frontend `
        -WindowStyle Hidden `
        -RedirectStandardOutput $FrontendOut `
        -RedirectStandardError $FrontendErr

    Wait-ForPort -Port 3000 -Name "Next.js frontend"
}

Write-Host ""
Write-Host "Ready:"
Write-Host "Frontend: http://127.0.0.1:3000/plan"
Write-Host "Backend:  http://127.0.0.1:5000/api/health"
Write-Host ""
Write-Host "Logs:"
Write-Host "Backend:  $BackendOut"
Write-Host "Frontend: $FrontendOut"
Write-Host ""
Write-Host "Keep this project folder. If the app stops, run this script again."
