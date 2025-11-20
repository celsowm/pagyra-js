<#
.SYNOPSIS
    Abre um PDF, espera renderização completa, captura apenas a janela do PDF e salva como PNG.

.USAGE
    .\PdfToPng.ps1 "C:\Caminho\Documento.pdf"
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateScript({ Test-Path $_ -PathType Leaf })]
    [string]$PdfPath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Resolve caminho absoluto e nome do arquivo
$PdfPath = Resolve-Path $PdfPath
$Folder   = Split-Path $PdfPath -Parent
$BaseName = [System.IO.Path]::GetFileNameWithoutExtension($PdfPath)
$OutputPng = Join-Path $Folder "$BaseName.png"

# 1. Abre o PDF com o aplicativo padrão
Start-Process -FilePath $PdfPath -Verb Open
Write-Host "Abrindo $PdfPath ..."

# 2. Aguarda a janela do PDF aparecer (Edge = "Microsoft Edge", Adobe = "Adobe Acrobat" ou "Acrobat Reader")
$timeout = 20
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$process = $null

do {
    Start-Sleep -Milliseconds 500
    $process = Get-Process | Where-Object {
        $_.MainWindowTitle -like "*$BaseName*" -and
        ($_.ProcessName -eq "msedge" -or $_.ProcessName -like "Acrobat*" -or $_.ProcessName -eq "MicrosoftEdge")
    } | Select-Object -First 1
} until ($process -or $stopwatch.Elapsed.Seconds -gt $timeout)

if (-not $process) {
    Write-Error "Não foi possível detectar a janela do PDF em $timeout segundos."
    exit 1
}

$handle = $process.MainWindowHandle

# 3. Aguarda estabilizar e maximiza (importante para PDFs com scroll lento)
Start-Sleep -Seconds 3
[user32]::ShowWindow($handle, 3) | Out-Null  # SW_MAXIMIZE = 3

# Pequena pausa extra para renderização final (ajuste se seus PDFs forem muito pesados)
Start-Sleep -Seconds 2

# 4. Obtém os limites reais da janela do PDF (exclui bordas externas)
$rect = New-Object RECT
$user32::GetWindowRect($handle, [ref]$rect) | Out-Null

$left   = $rect.Left
$top    = $rect.Top
$width  = $rect.Right  - $rect.Left
$height = $rect.Bottom - $rect.Top

# 5. Captura apenas a área da janela
$bitmap  = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size, [System.Drawing.CopyPixelOperation]::SourceCopy)

# 6. Salva como PNG
$bitmap.Save($OutputPng, [System.Drawing.Imaging.ImageFormat]::Png)

# Verifica se o PNG foi criado com sucesso
if (Test-Path $OutputPng) {
    Write-Host "PNG gerado com sucesso: $OutputPng" -ForegroundColor Green
} else {
    Write-Error "Erro: Falha ao salvar o arquivo PNG."
    exit 1
}

# Limpeza
$bitmap.Dispose()
$graphics.Dispose()

# 7. Fecha o visualizador do PDF
Stop-Process -Id $process.Id -Force

Write-Host "Captura concluída com sucesso!" -ForegroundColor Green
Write-Host "PNG salvo em: $OutputPng"

# ==================== Classes auxiliares P/Invoke ====================
Add-Type @"
using System;
using System.Runtime.InteropServices;

public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public static class user32 {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, [In, Out] ref RECT lpRect);

    [DllImport("user32.dll")]
    public static extern int ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
