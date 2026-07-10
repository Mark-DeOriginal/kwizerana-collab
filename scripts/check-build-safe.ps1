$ErrorActionPreference = "Stop"

$ports = @(3000, 3001)
$listeners = @()

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($connections) {
    $listeners += $connections
  }
}

if ($listeners.Count -gt 0) {
  $portsInUse = ($listeners | Select-Object -ExpandProperty LocalPort -Unique) -join ", "
  throw "Stop the dev server before running npm run build. Port(s) in use: $portsInUse. Running next build while next dev is open can rewrite .next and make CSS assets disappear."
}
