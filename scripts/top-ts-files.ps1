# Top 10 arquivos .ts por número de linhas (recursivo, com progresso)
$Path = "."      # diretório inicial
$Top = 10        # quantidade a exibir
$Pattern = "*.ts"
$SkipPattern = '(\\|/)(?:node_modules|dist|\.git|bin|obj|\.venv|\.tox)(\\|/)'

Write-Host "🔍 Buscando arquivos $Pattern em $Path..." -ForegroundColor Cyan

# filtra apenas .ts e ignora pastas grandes
$files = Get-ChildItem -LiteralPath $Path -Recurse -File -Filter $Pattern -Force |
          Where-Object { $_.FullName -notmatch $SkipPattern }

$total = $files.Count
if ($total -eq 0) {
  Write-Host "Nenhum arquivo $Pattern encontrado (verifique filtros)." -ForegroundColor Yellow
  return
}

$i = 0
$results = New-Object System.Collections.Generic.List[object]

foreach ($f in $files) {
  $i++
  Write-Progress -Activity "Contando linhas..." -Status $f.FullName -PercentComplete (($i / $total) * 100)
  try {
    $lineCount = [int]([System.Linq.Enumerable]::Count([System.IO.File]::ReadLines($f.FullName)))
    $results.Add([pscustomobject]@{
      Lines     = $lineCount
      SizeBytes = $f.Length
      Path      = $f.FullName
    })
  } catch {
    Write-Warning "Falha ao ler: $($f.FullName) -> $($_.Exception.Message)"
  }
}

Write-Progress -Activity "Contando linhas..." -Completed
Write-Host "`n📊 Top $Top arquivos $Pattern por número de linhas:`n" -ForegroundColor Green

$results |
  Sort-Object Lines -Descending |
  Select-Object -First $Top |
  Format-Table Lines, SizeBytes, Path -AutoSize
