#!/bin/bash

# Top 10 arquivos .ts por número de linhas (recursivo, com progresso)
PATH="."
TOP=10
PATTERN="*.ts"
SKIP_PATTERN="(node_modules|dist|\.git|bin|obj|\.venv|\.tox)"

echo "🔍 Buscando arquivos $PATTERN em $PATH..."

# filtra apenas .ts e ignora pastas grandes
files=$(find "$PATH" -type f -name "$PATTERN" 2>/dev/null | grep -v -E "$SKIP_PATTERN")

total=$(echo "$files" | wc -l)
if [ "$total" -eq 0 ]; then
  echo "Nenhum arquivo $PATTERN encontrado (verifique filtros)."
  exit 1
fi

i=0
temp=$(mktemp)

echo "$files" | while read -r f; do
  i=$((i+1))
  echo -ne "Contando linhas... $i/$total\r"
  lines=$(wc -l < "$f" 2>/dev/null || echo 0)
  size=$(stat -c%s "$f" 2>/dev/null || echo 0)
  echo "$lines|$size|$f" >> "$temp"
done

echo ""
echo "📊 Top $TOP arquivos $PATTERN por número de linhas:"
echo ""

sort -nr "$temp" | head -n $TOP | awk -F'|' '{printf "%-10s %-10s %s\n", $1, $2, $3}'

rm "$temp"
