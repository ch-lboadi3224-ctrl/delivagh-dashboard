$lines = Get-Content 'src\Landing.css'
$rootProps = @()
$out = @()

foreach ($line in $lines) {
  $trimmed = $line.Trim()
  if ($trimmed -eq '') { $out += $line; continue }
  if ($trimmed.StartsWith('/*')) { $out += $line; continue }

  # Extract selector and body
  if ($line -match '^([^{]+)\{(.+)\}$') {
    $sel = $Matches[1].Trim()
    $body = $Matches[2]

    if ($sel -eq '*' -or $sel -eq 'html' -or $sel -eq 'body') {
      $rootProps += $body
    } elseif ($sel -eq '@keyframes pulse') {
      $out += $line
    } else {
      $out += ".landing-root $sel{$body}"
    }
  } elseif ($line -match '^\}') {
    $out += $line
  } elseif ($line -match '^@keyframes') {
    $out += $line
  } else {
    $out += ".landing-root $line"
  }
}

$mergedRoot = ".landing-root{" + ($rootProps -join ';') + "}"
$boxSizing = ".landing-root *{box-sizing:border-box}"

$final = @($mergedRoot, $boxSizing, '') + $out
[System.IO.File]::WriteAllLines("$PWD\src\Landing.css", $final)
Write-Host "Landing.css scoped"
