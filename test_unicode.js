import { needsUnicode } from './src/text/text.js';

// Test cases
const testCases = [
  { text: "Hello world", expected: false, description: "ASCII text only" },
  { text: "Café résumé naïve", expected: false, description: "Basic accented characters in WinAnsi" },
  { text: "✓ checkmark", expected: true, description: "Checkmark symbol" },
  { text: "★ star symbol", expected: true, description: "Star symbol" },
  { text: "Variação", expected: true, description: "Combining marks (precomposed)" },
  { text: "Varia\u0063\u0327\u0061\u0303o", expected: true, description: "Combining marks (decomposed)" },
  { text: "café ✓ résumé ★", expected: true, description: "Mixed accented + symbols" }
];

console.log("Testing needsUnicode function:");
testCases.forEach(({ text, expected, description }) => {
  const result = needsUnicode(text);
  const pass = result === expected;
  console.log(`${pass ? '✓' : '✗'} ${description}: ${result} (expected ${expected})`);
  if (!pass) {
    console.log(`  Text: "${text}"`);
  }
});
