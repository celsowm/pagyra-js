param(
    [Parameter(Mandatory = $true)]
    [string]$File
)

# Executa woff2_info e força captura de TUDO
$cmd = ".\woff2_info.exe `"$File`" 2>&1"
$output = Invoke-Expression $cmd

# Se não houve saída, imprime uma mensagem útil
if ([string]::IsNullOrWhiteSpace($output)) {
    Write-Output "[INFO] No stdout/stderr produced. File appears valid or binary is quiet."
}
else {
    Write-Output $output
}
