param(
    # Caminho da fonte (TTF/OTF/WOFF/WOFF2)
    [Parameter(Mandatory = $true)]
    [string]$File,

    # ttx (CLI da FontTools)
    [string]$Ttx = "ttx",

    # Nome do arquivo de saída TTX
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

$ttxOut = Join-Path $PSScriptRoot $OutFile

if ((Test-Path $ttxOut) -and (-not $Force)) {
    Write-Output "[ERROR] Output file already exists: $ttxOut"
    Write-Output "Use -Force to overwrite."
    exit 1
}

if ($Force -and (Test-Path $ttxOut)) {
    Remove-Item $ttxOut -Force
}

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
    return ($obj | ConvertTo-Json -Depth 20 -Indent 2)
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
