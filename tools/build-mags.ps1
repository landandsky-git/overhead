# Builds data/mags.json: the typical ("standard") brightness of every satellite in the app's lists.
#   m = measured, from Mike McCants' quicksat.mag catalog (mmccants.org)
#   r = estimated from radar size (quicksat.mag or the CelesTrak satellite catalog), using a fit
#       of measured brightness against radar size over all objects that have both
#   new = launch date of satellites launched in the last 60 days
# Standard brightness here means: 1,000 km away and half lit (sun at 90 degrees), the convention the
# app uses. McCants' values are for a fully lit satellite, which for the diffuse-sphere model the app
# uses is 2.5*log10(pi) = 1.24 magnitudes brighter.
# Runs in the GitHub workflow (pwsh on Linux) and in Windows PowerShell 5.1 for testing.
param(
  [Parameter(Mandatory = $true)] [string]$QuicksatMag,
  [Parameter(Mandatory = $true)] [string]$Satcat,
  [Parameter(Mandatory = $true)] [string[]]$OrbitFiles,
  [Parameter(Mandatory = $true)] [string]$Out
)
$ErrorActionPreference = "Stop"
$HalfLit = 1.24

# NORAD numbers above 99999 are written as a letter plus four digits ("Alpha-5"), skipping I and O.
function ConvertTo-Alpha5([long]$n) {
  if ($n -lt 100000) { return $n.ToString("00000") }
  return "ABCDEFGHJKLMNPQRSTUVWXYZ"[[int][Math]::Floor($n / 10000) - 10] + ($n % 10000).ToString("0000")
}

# The satellites the app shows, from the CelesTrak CSV lists (or classic two-line files).
$ids = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($f in $OrbitFiles) {
  if (-not (Test-Path $f)) { continue }
  if ($f -like "*.csv") {
    foreach ($row in (Import-Csv $f)) { if ($row.NORAD_CAT_ID) { [void]$ids.Add((ConvertTo-Alpha5 ([long]$row.NORAD_CAT_ID))) } }
  } else {
    foreach ($l in [IO.File]::ReadLines((Resolve-Path $f))) {
      if ($l.StartsWith("1 ") -and $l.Length -ge 7) { [void]$ids.Add($l.Substring(2, 5).Trim()) }
    }
  }
}

# quicksat.mag: fixed columns. NORAD 1-5, magnitude 34-38, radar cross-section 51-56 (square metres).
$mag = @{}; $rcs = @{}
foreach ($l in [IO.File]::ReadLines((Resolve-Path $QuicksatMag))) {
  if ($l.Length -lt 38 -or $l -notmatch '^[0-9A-Z]\d{4}') { continue }
  $id = $l.Substring(0, 5)
  $m = $l.Substring(33, [Math]::Min(5, $l.Length - 33)).Trim()
  if ($m -match '^-?\d+(\.\d+)?$') { $mag[$id] = [double]$m }
  if ($l.Length -gt 50) {
    $r = $l.Substring(50, [Math]::Min(6, $l.Length - 50)).Trim()
    if ($r -match '^\d*\.?\d+$' -and [double]$r -gt 0) { $rcs[$id] = [double]$r }
  }
}

# Fit: brightness = a + b * log10(radar size), over objects with both.
$n = 0; $sx = 0.0; $sy = 0.0; $sxx = 0.0; $sxy = 0.0
foreach ($id in $mag.Keys) {
  if (-not $rcs.ContainsKey($id)) { continue }
  $x = [Math]::Log10($rcs[$id]); $y = $mag[$id]
  $n++; $sx += $x; $sy += $y; $sxx += $x * $x; $sxy += $x * $y
}
if ($n -lt 100) { throw "Too few objects with both brightness and radar size ($n)" }
$b = ($n * $sxy - $sx * $sy) / ($n * $sxx - $sx * $sx)
$a = ($sy - $b * $sx) / $n

# From the CelesTrak catalog: radar sizes where quicksat.mag has none, and launch dates of anything
# launched in the last 60 days (new Starlinks fly in a much brighter attitude while climbing).
$recent = [ordered]@{}
$cutoff = (Get-Date).ToUniversalTime().AddDays(-60).ToString("yyyy-MM-dd")
foreach ($row in (Import-Csv $Satcat)) {
  $id = ConvertTo-Alpha5 ([long]$row.NORAD_CAT_ID)
  if (-not $ids.Contains($id)) { continue }
  if ($row.RCS -and -not $rcs.ContainsKey($id) -and [double]$row.RCS -gt 0) { $rcs[$id] = [double]$row.RCS }
  if ($row.LAUNCH_DATE -and $row.LAUNCH_DATE -ge $cutoff) { $recent[$id] = $row.LAUNCH_DATE }
}

$measured = [ordered]@{}; $radar = [ordered]@{}
foreach ($id in ($ids | Sort-Object)) {
  if ($mag.ContainsKey($id)) { $measured[$id] = [Math]::Round($mag[$id] + $HalfLit, 1) }
  elseif ($rcs.ContainsKey($id)) { $radar[$id] = [Math]::Round($a + $b * [Math]::Log10($rcs[$id]) + $HalfLit, 1) }
}

$result = [ordered]@{
  updated = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  note = "Standard magnitude: 1000 km away, half lit. m = measured (McCants quicksat.mag), r = from radar size."
  fit = [ordered]@{ a = [Math]::Round($a, 2); b = [Math]::Round($b, 2); objects = $n }
  m = $measured
  r = $radar
  new = $recent
}
$dir = Split-Path -Parent $Out
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
[IO.File]::WriteAllText($Out, ($result | ConvertTo-Json -Compress -Depth 3))
Write-Host ("Brightness table: {0} satellites listed, {1} measured, {2} from radar size, {3} launched in the last 60 days; fit {4:N2} + {5:N2} log10(RCS) over {6} objects" -f $ids.Count, $measured.Count, $radar.Count, $recent.Count, $a, $b, $n)
