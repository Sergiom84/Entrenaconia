Write-Host "Limpiando procesos Node.js..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Iniciando desarrollo..."
npm run dev:auto