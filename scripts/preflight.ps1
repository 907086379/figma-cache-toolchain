param(
  [ValidateSet("warn", "strict")]
  [string]$Mode = "warn"
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
  Write-Host "[preflight] $Message"
}

function Write-Warn([string]$Message) {
  Write-Warning "[preflight] $Message"
}

$hostVersion = $PSVersionTable.PSVersion
$hostEdition = $PSVersionTable.PSEdition
$hostName = "$($hostEdition) $($hostVersion.ToString())"

$pwshPath = ""
$pwshVersion = ""
$pwshMajor = 0

$pwshCommand = Get-Command pwsh -ErrorAction SilentlyContinue
if ($null -ne $pwshCommand) {
  $pwshPath = $pwshCommand.Source
  try {
    $pwshVersion = pwsh -NoLogo -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'
    $pwshVersion = "$pwshVersion".Trim()
    if ($pwshVersion) {
      $pwshMajor = [int]($pwshVersion.Split(".")[0])
    }
  } catch {
    $pwshVersion = "unknown"
  }
}

$issues = New-Object System.Collections.Generic.List[string]

if ($hostVersion.Major -lt 7) {
  $issues.Add("Current host is $hostName (no native '&&' support).")
}

if (-not $pwshPath) {
  $issues.Add("pwsh is not available in PATH.")
} elseif ($pwshMajor -lt 7) {
  $issues.Add("pwsh version is '$pwshVersion' (<7).")
}

Write-Info "mode=$Mode"
Write-Info "host=$hostName"
if ($pwshPath) {
  Write-Info "pwsh=$pwshVersion ($pwshPath)"
} else {
  Write-Info "pwsh=missing"
}

if ($issues.Count -eq 0) {
  Write-Info "OK: shell environment is ready."
  exit 0
}

foreach ($issue in $issues) {
  Write-Warn $issue
}

Write-Info "Hint: set Cursor default terminal profile to PowerShell 7 (pwsh)."

if ($Mode -eq "strict") {
  [Console]::Error.WriteLine("[preflight] FAILED in strict mode.")
  exit 2
}

Write-Info "Completed in warn mode."
exit 0