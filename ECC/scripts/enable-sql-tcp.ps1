# Enable SQL Server TCP/IP - Run as Administrator!
# powershell -ExecutionPolicy Bypass -File enable-sql-tcp.ps1

$ErrorActionPreference = "Stop"

# Load SQL Server WMI provider
[System.Reflection.Assembly]::LoadWithPartialName("Microsoft.SqlServer.SqlWmiManagement") | Out-Null

try {
    $wmi = New-Object Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer
    $tcp = $wmi.ServerInstances['MSSQLSERVER'].ServerProtocols['Tcp']

    Write-Host "Current TCP/IP Status: $($tcp.IsEnabled)" -ForegroundColor Yellow

    if (-not $tcp.IsEnabled) {
        Write-Host "Enabling TCP/IP..." -ForegroundColor Cyan
        $tcp.IsEnabled = $true
        $tcp.Alter()
        Write-Host "TCP/IP Enabled!" -ForegroundColor Green
    }

    # Set to listen on all IPs on port 1433
    $ipAll = $tcp.IPAddresses | Where-Object { $_.Name -eq 'IPAll' }
    $ipAll.IPAddressProperties['TcpPort'].Value = '1433'
    $ipAll.IPAddressProperties['TcpDynamicPorts'].Value = ''
    $tcp.Alter()

    Write-Host "`nRestarting SQL Server service..." -ForegroundColor Cyan
    Restart-Service -Name MSSQLSERVER -Force
    Start-Sleep -Seconds 3

    Write-Host "`n=== Verifying ===" -ForegroundColor Cyan
    netstat -an | Select-String ":1433.*LISTEN"

    Write-Host "`nDone! SQL Server should now be accessible on:" -ForegroundColor Green
    Write-Host "  - 172.25.112.1:1433 (WSL adapter)" -ForegroundColor Green
    Write-Host "  - 192.168.0.2:1433 (LAN)" -ForegroundColor Green

} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "`nManual fix: Open 'SQL Server Configuration Manager'" -ForegroundColor Yellow
    Write-Host "  1. SQL Server Network Configuration > Protocols for MSSQLSERVER" -ForegroundColor Yellow
    Write-Host "  2. Right-click TCP/IP > Enable" -ForegroundColor Yellow
    Write-Host "  3. Right-click TCP/IP > Properties > IP Addresses > IPAll" -ForegroundColor Yellow
    Write-Host "  4. Set TCP Port = 1433, clear TCP Dynamic Ports" -ForegroundColor Yellow
    Write-Host "  5. Restart SQL Server service" -ForegroundColor Yellow
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
