# SQL Server Discovery Script
# Run this on Windows: powershell -ExecutionPolicy Bypass -File discover-sql.ps1

Write-Host "=== SQL Server Services ===" -ForegroundColor Cyan
Get-Service | Where-Object { $_.Name -like '*SQL*' } |
    Format-Table Name, Status, DisplayName -AutoSize

Write-Host "`n=== SQL Server Ports ===" -ForegroundColor Cyan
Get-NetTCPConnection -LocalPort 1433 -ErrorAction SilentlyContinue |
    Format-Table LocalAddress, LocalPort, State -AutoSize
if (-not $?) { Write-Host "Nothing listening on 1433" -ForegroundColor Yellow }

Write-Host "`n=== All SQL-related Listeners ===" -ForegroundColor Cyan
netstat -an | Select-String ":143[34].*LISTEN"

Write-Host "`n=== Network Adapters (for WSL connection) ===" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' } |
    Format-Table InterfaceAlias, IPAddress -AutoSize

Write-Host "`n=== WSL Adapter Specifically ===" -ForegroundColor Cyan
Get-NetIPAddress | Where-Object { $_.InterfaceAlias -like '*WSL*' } |
    Format-Table InterfaceAlias, IPAddress -AutoSize

Write-Host "`n=== Recommended .mcp.json Connection String ===" -ForegroundColor Green
$wslIP = (Get-NetIPAddress | Where-Object { $_.InterfaceAlias -like '*WSL*' -and $_.AddressFamily -eq 'IPv4' }).IPAddress
if ($wslIP) {
    Write-Host "Server=$wslIP;Database=ClaudeConfig;User Id=claude_mcp;Password=YourSecurePassword123!;TrustServerCertificate=True;"
} else {
    $lanIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -First 1).IPAddress
    Write-Host "Server=$lanIP;Database=ClaudeConfig;User Id=claude_mcp;Password=YourSecurePassword123!;TrustServerCertificate=True;"
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
