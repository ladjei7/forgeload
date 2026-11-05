import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSteps, videoSearchUrl } from '../app/lib/howto.ts';

test('numbered instructions become clean steps', () => {
  assert.deepEqual(parseSteps('1. Sit down.\r\n2. Grab the handles.\n\n3) Pull.'), ['Sit down.', 'Grab the handles.', 'Pull.']);
});
test('bullets and blank lines are handled; empty input gives no steps', () => {
  assert.deepEqual(parseSteps('- One\n• Two\n   \n* Three'), ['One', 'Two', 'Three']);
  assert.deepEqual(parseSteps(null), []); assert.deepEqual(parseSteps(''), []);
});
test('a number inside a step is kept', () => {
  assert.deepEqual(parseSteps('1. Lower for 3 seconds.'), ['Lower for 3 seconds.']);
});
test('video link is a YouTube search for the exercise plus "proper form", safely encoded', () => {
  assert.equal(videoSearchUrl(' Seated Cable Row '), 'https://www.youtube.com/results?search_query=Seated%20Cable%20Row%20proper%20form');
  assert.ok(videoSearchUrl('Squat & Press / DB').startsWith('https://www.youtube.com/results?search_query=Squat%20%26%20Press%20%2F%20DB'));
});
