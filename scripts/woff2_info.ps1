param(
    # Caminho da fonte (TTF/OTF/WOFF/WOFF2)
    [Parameter(Mandatory = $true)]
    [string]$File,

    # ttx (CLI da FontTools)
    [string]$Ttx = "ttx",

    # Nome base do arquivo de saída TTX (sem ou com .ttx)
    # O script vai adicionar automaticamente o sufixo com o nome da fonte.
    [string]$OutFile = "font_dump.ttx",

    # Formato da saída do script
    # xml      = só gera TTX XML (default)
    # json     = converte o XML inteiro pra JSON
    # fulljson = JSON completo sem compressão
    # name     = só tabela name (metadados)
    # cmap     = só cmap
    # metrics  = só head / hhea / OS/2
    [ValidateSet("xml", "json", "fulljson", "name", "cmap", "metrics")]
    [string]$Format = "xml",

    # Forçar overwrite
    [switch]$Force
)

### 1. Resolve paths
$fullPath = (Resolve-Path $File).Path

# Nome da fonte baseado no arquivo (sem extensão)
$fontBaseName = [System.IO.Path]::GetFileNameWithoutExtension($fullPath)

# Se o usuário passou um caminho com diretório em $OutFile, respeita.
# Caso contrário, usa o diretório do script.
$outDir = Split-Path -Path $OutFile -Parent
if ([string]::IsNullOrWhiteSpace($outDir)) {
    $outDir = $PSScriptRoot
}

$outName = [System.IO.Path]::GetFileName($OutFile)

# Se não tiver extensão, assume .ttx
$outBase = [System.IO.Path]::GetFileNameWithoutExtension($outName)
$outExt = [System.IO.Path]::GetExtension($outName)
if ([string]::IsNullOrWhiteSpace($outExt)) {
    $outExt = ".ttx"
}

# Monta o nome final com sufixo da fonte
$finalOutName = "{0}-{1}{2}" -f $outBase, $fontBaseName, $outExt
$ttxOut = Join-Path $outDir $finalOutName

if ((Test-Path $ttxOut) -and (-not $Force)) {
    Write-Output "[ERROR] Output file already exists: $ttxOut"
    Write-Output "Use -Force to overwrite."
    exit 1
}

if ($Force -and (Test-Path $ttxOut)) {
    Remove-Item $ttxOut -Force
}

Write-Output "[INFO] Generating TTX to: $ttxOut"

### 2. Gera o TTX (XML)
$cmd = "$Ttx -o `"$ttxOut`" `"$fullPath`" 2>&1"
$output = Invoke-Expression $cmd

if (-not (Test-Path $ttxOut)) {
    Write-Output "[ERROR] Failed to generate TTX dump."
    Write-Output $output
    exit 1
}

### 3. Se o usuário pediu só XML
if ($Format -eq "xml") {
    Write-Output "[DUMP] $((Resolve-Path $ttxOut).Path)"
    exit 0
}

### 4. Carrega XML como objeto
[xml]$xml = Get-Content $ttxOut

### 5. Funções auxiliares
function Convert-ToJsonCompact($obj) {
    return ($obj | ConvertTo-Json -Depth 20 -Compress)
}

function Convert-ToJsonPretty($obj) {
    return ($obj | ConvertTo-Json -Depth 20)
}

### 6. Modos especializados
switch ($Format) {

    "json" {
        $json = Convert-ToJsonCompact $xml
        Write-Output $json
        exit 0
    }

    "fulljson" {
        $json = Convert-ToJsonPretty $xml
        Write-Output $json
        exit 0
    }

    "name" {
        $name = $xml.ttFont.name
        $json = Convert-ToJsonPretty $name
        Write-Output $json
        exit 0
    }

    "cmap" {
        $cmap = $xml.ttFont.cmap
        $json = Convert-ToJsonPretty $cmap
        Write-Output $json
        exit 0
    }

    "metrics" {
        $metrics = [ordered]@{
            head = $xml.ttFont.head
            hhea = $xml.ttFont.hhea
            os2  = $xml.ttFont."OS_2"
        }
        $json = Convert-ToJsonPretty $metrics
        Write-Output $json
        exit 0
    }
}
