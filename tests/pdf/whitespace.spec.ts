import { describe, it, expect } from "vitest";
import { renderTreeForHtml } from "../helpers/render-utils.js";

// Helper para pegar a caixa principal, ajustando conforme a estrutura da sua árvore
function findMainBox(tree: any) {
    // Geralmente: Root -> Body -> Div
    const body = tree.root.children[0];
    // Pega o primeiro filho do body (a div .box)
    return body.children[0];
}

describe("HTML Whitespace Handling", () => {
    it("ignores whitespace (newlines/indentation) between tags in inline-block", async () => {
        // Cenário 1: HTML "Limpo" (Minificado, sem espaços entre tags)
        // Esse é o valor correto de referência.
        const cleanHtml = `
<!DOCTYPE html>
<html>
<head><style>.box { display: inline-block; font-family: Arial; font-size: 16px; }</style></head>
<body>
  <div class="box"><span>Texto</span></div>
</body>
</html>`.trim();

        // Cenário 2: HTML "Sujo" (Com quebras de linha e indentação)
        // Se o motor estiver certo, o resultado deve ser IDÊNTICO ao limpo.
        const dirtyHtml = `
<!DOCTYPE html>
<html>
<head><style>.box { display: inline-block; font-family: Arial; font-size: 16px; }</style></head>
<body>
  <div class="box">
    <span>Texto</span>
  </div>
</body>
</html>`.trim();

        const treeClean = await renderTreeForHtml(cleanHtml);
        const treeDirty = await renderTreeForHtml(dirtyHtml);

        const boxClean = findMainBox(treeClean);
        const boxDirty = findMainBox(treeDirty);

        const widthClean = boxClean.borderBox.width;
        const widthDirty = boxDirty.borderBox.width;

        console.log(`\n🔍 DIAGNÓSTICO DE WHITESPACE:`);
        console.log(`--------------------------------------------------`);
        console.log(`Largura "Limpa" (Sem espaços): ${widthClean.toFixed(2)}px`);
        console.log(`Largura "Suja"  (Com espaços): ${widthDirty.toFixed(2)}px`);
        console.log(`Diferença: ${Math.abs(widthDirty - widthClean).toFixed(2)}px`);

        // 1. CHECAGEM DE SEGURANÇA: O texto sumiu?
        if (widthClean === 0) {
            console.error(`\n🚨 CRÍTICO: A largura está 0! Você filtrou o texto real sem querer.`);
            console.error(`   Verifique se sua lógica de ignorar nós não está agressiva demais.`);
        }
        // 2. CHECAGEM DE FALHA: O espaço está contando?
        else if (widthDirty > widthClean + 1) {
            console.error(`\n❌ FALHA: O HTML com indentação ficou maior.`);
            console.error(`   Você precisa ignorar nós de texto que contém apenas quebras de linha/espaços.`);
        } else {
            console.log(`\n✅ SUCESSO: O motor ignorou a indentação corretamente.`);
        }
        console.log(`--------------------------------------------------\n`);

        // Assegura que não quebrou o render do texto (não pode ser zero)
        expect(widthClean).toBeGreaterThan(0);

        // Assegura que as larguras são iguais (tolerância pequena para float)
        expect(widthDirty).toBeCloseTo(widthClean, 0.5);
    });
});