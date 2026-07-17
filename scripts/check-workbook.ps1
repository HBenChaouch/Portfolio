param(
  [string]$WorkbookPath = (Join-Path $PSScriptRoot '..\Sidetrade_Valuation_2026_v2.xlsx')
)

$ErrorActionPreference = 'Stop'
$expectedHash = 'B0D93B0A7BF346C2D02D90DC6F83D23C80D9422D902AF1E95E7CA40D385F8ECD'
$officeRelNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
$errorTokens = @('#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#N/A', '#NUM!', '#NULL!')
$invariant = [System.Globalization.CultureInfo]::InvariantCulture

function Assert-Equal($Actual, $Expected, [string]$Label) {
  if ($Actual -ne $Expected) {
    throw "$Label`: expected '$Expected', got '$Actual'"
  }
}

function Assert-Close([double]$Actual, [double]$Expected, [double]$Tolerance, [string]$Label) {
  if ([Math]::Abs($Actual - $Expected) -gt $Tolerance) {
    throw "$Label`: expected $Expected +/- $Tolerance, got $Actual"
  }
}

function Read-ZipXml($Archive, [string]$EntryName) {
  $entry = $Archive.GetEntry($EntryName)
  if (-not $entry) { throw "Missing workbook entry: $EntryName" }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    $document = [System.Xml.XmlDocument]::new()
    $document.PreserveWhitespace = $false
    $document.LoadXml($reader.ReadToEnd())
    return $document
  }
  finally { $reader.Dispose() }
}

function Get-CellValue($Sheet, $SharedStrings, [string]$Reference) {
  $cell = $Sheet.SelectSingleNode("//*[local-name()='c' and @r='$Reference']")
  if (-not $cell) { return $null }
  $type = $cell.GetAttribute('t')
  $valueNode = $cell.SelectSingleNode("*[local-name()='v']")
  if ($type -eq 'inlineStr') {
    return $cell.SelectSingleNode("*[local-name()='is']").InnerText
  }
  if (-not $valueNode) { return $null }
  $raw = $valueNode.InnerText
  if ($type -eq 's') { return $SharedStrings[[int]$raw] }
  if ($type -eq 'b') { return $raw -eq '1' }
  if ($type -in @('str', 'e')) { return $raw }
  $number = 0.0
  if ([double]::TryParse($raw, [System.Globalization.NumberStyles]::Float, $invariant, [ref]$number)) {
    return $number
  }
  return $raw
}

$resolvedWorkbook = (Resolve-Path -LiteralPath $WorkbookPath).Path
$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedWorkbook).Hash
Assert-Equal $actualHash $expectedHash 'Workbook SHA-256'

Add-Type -AssemblyName System.IO.Compression
$stream = [System.IO.File]::Open($resolvedWorkbook, 'Open', 'Read', 'ReadWrite')
$archive = [System.IO.Compression.ZipArchive]::new($stream, 'Read', $false)
try {
  $sharedStrings = @()
  if ($archive.GetEntry('xl/sharedStrings.xml')) {
    $sharedDocument = Read-ZipXml $archive 'xl/sharedStrings.xml'
    $sharedStrings = @($sharedDocument.SelectNodes("//*[local-name()='si']") | ForEach-Object { $_.InnerText })
  }

  $workbook = Read-ZipXml $archive 'xl/workbook.xml'
  $relationships = Read-ZipXml $archive 'xl/_rels/workbook.xml.rels'
  $sheetEntries = @{}
  foreach ($sheet in $workbook.SelectNodes("//*[local-name()='sheets']/*[local-name()='sheet']")) {
    $relationshipId = $sheet.GetAttribute('id', $officeRelNs)
    $relationship = $relationships.SelectSingleNode("//*[local-name()='Relationship' and @Id='$relationshipId']")
    if (-not $relationship) { throw "Missing relationship for sheet $($sheet.GetAttribute('name'))" }
    $target = $relationship.GetAttribute('Target').Replace('\', '/')
    if ($target.StartsWith('/')) { $target = $target.TrimStart('/') }
    elseif (-not $target.StartsWith('xl/')) { $target = "xl/$target" }
    $sheetEntries[$sheet.GetAttribute('name')] = $target
  }

  $sheetCache = @{}
  function Get-Sheet([string]$Name) {
    if (-not $sheetEntries.ContainsKey($Name)) { throw "Missing worksheet: $Name" }
    if (-not $sheetCache.ContainsKey($Name)) {
      $sheetCache[$Name] = Read-ZipXml $archive $sheetEntries[$Name]
    }
    return $sheetCache[$Name]
  }

  $checks = Get-Sheet 'Checks'
  $individualStatuses = 4..17 | ForEach-Object { Get-CellValue $checks $sharedStrings "D$_" }
  Assert-Equal $individualStatuses.Count 14 'Checks count'
  foreach ($status in $individualStatuses) { Assert-Equal $status 'PASS' 'Individual workbook check' }
  Assert-Equal (Get-CellValue $checks $sharedStrings 'D18') 'PASS' 'Global workbook status'

  $sentinels = @(
    @('DCF', 'Q34', 157.92188754137794, 1e-9),
    @('DCF', 'R34', 301.1945261610796, 1e-9),
    @('DCF', 'S34', 497.11513516286425, 1e-9),
    @('Sensitivity', 'E8', 301.1945261610796, 1e-9),
    @('Sensitivity', 'E18', 413.20102561047105, 1e-9),
    @('Margin_path', 'B35', 301.1945261610796, 1e-9),
    @('Margin_path', 'C35', 303.62190791834485, 1e-9),
    @('Margin_path', 'D35', 298.71237139761627, 1e-9),
    @('Football_field', 'B6', 171.0, 1e-9),
    @('Football_field', 'C6', 202.0, 1e-9),
    @('Football_field', 'D6', 264.0, 1e-9),
    @('Football_field', 'B7', 289.0, 1e-9),
    @('Football_field', 'C7', 411.0, 1e-9),
    @('Football_field', 'D7', 547.0, 1e-9),
    @('Football_field', 'B8', 222.5, 1e-9),
    @('Football_field', 'C8', 241.9, 1e-9),
    @('Football_field', 'D8', 283.5, 1e-9),
    @('Football_field', 'C14', 282.05546, 1e-9),
    @('Equity_bridge', 'C12', 14.654, 1e-9),
    @('Equity_bridge', 'C15', 286.5405261610796, 1e-9),
    @('Equity_bridge', 'C18', 1536790.0, 1e-6),
    @('Equity_bridge', 'C20', 186.45392419333777, 1e-9),
    @('FY25_base', 'B46', 30.981, 1e-9),
    @('FY25_base', 'B49', 14.654, 1e-9),
    @('FY25_base', 'B55', 2.947, 1e-9),
    @('FY25_base', 'B56', 7.163, 1e-9)
  )
  foreach ($sentinel in $sentinels) {
    $actual = Get-CellValue (Get-Sheet $sentinel[0]) $sharedStrings $sentinel[1]
    Assert-Close ([double]$actual) ([double]$sentinel[2]) ([double]$sentinel[3]) "$($sentinel[0])!$($sentinel[1])"
  }

  $formulaErrors = @()
  foreach ($entry in $archive.Entries | Where-Object { $_.FullName -match '^xl/worksheets/[^/]+\.xml$' }) {
    $sheet = Read-ZipXml $archive $entry.FullName
    foreach ($cell in $sheet.SelectNodes("//*[local-name()='c' and @t='e']")) {
      $value = $cell.SelectSingleNode("*[local-name()='v']").InnerText
      if ($errorTokens -contains $value) { $formulaErrors += "$($entry.FullName)!$($cell.GetAttribute('r'))=$value" }
    }
  }
  Assert-Equal $formulaErrors.Count 0 'Cached Excel formula errors'

  Write-Host "Workbook SHA-256: $actualHash"
  Write-Host 'Workbook checks: 14/14 PASS; global PASS'
  Write-Host "Workbook sentinels: $($sentinels.Count)/$($sentinels.Count) OK"
  Write-Host 'Cached Excel formula errors: 0'
}
finally {
  $archive.Dispose()
  $stream.Dispose()
}
