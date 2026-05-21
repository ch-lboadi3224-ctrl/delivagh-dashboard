$lines = Get-Content 'src\Privacy.css'
$rootProps = @()
$out = @()

foreach ($line in $lines) {
  $trimmed = $line.Trim()
  if ($trimmed -eq '') { $out += $line; continue }
  if ($trimmed.StartsWith('/*')) { $out += $line; continue }

  if ($line -match '^([^{]+)\{(.+)\}$') {
    $sel = $Matches[1].Trim()
    $body = $Matches[2]

    if ($sel -eq '*' -or $sel -eq 'html' -or $sel -eq 'body') {
      $rootProps += $body
    } else {
      $out += ".privacy-root $sel{$body}"
    }
  } else {
    $out += ".privacy-root $line"
  }
}

$mergedRoot = ".privacy-root{" + ($rootProps -join ';') + "}"
$boxSizing = ".privacy-root *{box-sizing:border-box}"

$final = @($mergedRoot, $boxSizing, '') + $out
[System.IO.File]::WriteAllLines("$PWD\src\Privacy.css", $final)
Write-Host "Privacy.css scoped"
