$lines = Get-Content 'src\Terms.css'
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
      $out += ".terms-root $sel{$body}"
    }
  } else {
    $out += ".terms-root $line"
  }
}

$mergedRoot = ".terms-root{" + ($rootProps -join ';') + "}"
$boxSizing = ".terms-root *{box-sizing:border-box}"

$final = @($mergedRoot, $boxSizing, '') + $out
[System.IO.File]::WriteAllLines("$PWD\src\Terms.css", $final)
Write-Host "Terms.css scoped"
