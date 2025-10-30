const { parseHTML } = require("linkedom");

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relat?rio B?sico</title>
</head>
<body>
  <p>Voc? pode combinar <strong>?nfase</strong>, <em>it?lico</em> e at? mesmo refer?ncias externas como <a href="https://pagyra.dev">site oficial</a>.</p>
</body>
</html>`;

const { document } = parseHTML(html);
const p = document.querySelector('p');
Array.from(p.childNodes).forEach((node, i) => {
  console.log(i, node.nodeType, node.nodeName, JSON.stringify(node.textContent));
});
