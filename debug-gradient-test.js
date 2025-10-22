import { parseLinearGradient } from './src/css/parsers/gradient-parser.js';

console.log('Testing gradient parsing...');

// Test the exact gradient from the test case
const gradientValue = 'linear-gradient(to right, red, yellow)';
console.log('Input:', gradientValue);

const result = parseLinearGradient(gradientValue);
console.log('Result:', result);

// Test parsing with the background parser
import { parseBackgroundShorthand } from './src/css/parsers/background-parser.js';

const backgroundValue = 'linear-gradient(to right, red, yellow)';
console.log('\nTesting background parsing...');
const backgroundResult = parseBackgroundShorthand(backgroundValue);
console.log('Background result:', backgroundResult);
