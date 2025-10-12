import { needsUnicode } from './src/text/text.js';

// Test cases
const testCases = [
  { text: "Hello world", expected: false, description: "ASCII text only" },
  { text: "Café résumé naïve", expected: false, description: "Basic accented characters in WinAnsi" },
  { text: "✓ checkmark", expected: true, description: "Checkmark symbol" },
  { text: "★ star symbol", expected: true, description: "Star symbol" },
  { text: "Varia&#x0063;&#x0327;&#x0061;&#x0303;o", expected: true, description: "Combining marks" },
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
