// Quick test of the profanity filter
import { filterProfanity, containsProfanity } from './src/helpers/profanity_filter.ts';

console.log('\n=== Profanity Filter Tests ===\n');

// Test 1: Church context (should allow)
const test1 = "The sermon spoke of heaven and hell";
console.log('Test 1 (Church context):');
console.log('Input:', test1);
console.log('Output:', filterProfanity(test1, false));
console.log('Contains profanity?:', containsProfanity(test1));
console.log('');

// Test 2: Non-church context (should filter)
const test2 = "This is hell";
console.log('Test 2 (Non-church context):');
console.log('Input:', test2);
console.log('Output:', filterProfanity(test2, false));
console.log('');

// Test 3: Actual profanity (should always filter)
const test3 = "This is bad word s***";
console.log('Test 3 (Actual profanity):');
console.log('Input:', test3);
console.log('Output:', filterProfanity(test3, false));
console.log('');

// Test 4: Strict mode (filters everything)
const test4 = "The damned shall be saved";
console.log('Test 4 (Strict mode):');
console.log('Input:', test4);
console.log('Normal mode:', filterProfanity(test4, false));
console.log('Strict mode:', filterProfanity(test4, true));
console.log('');

console.log('=== All Tests Complete ===\n');
