// Run: npm test   (node --experimental-strip-types --test scripts/*.test.mjs)
//
// Small pure helpers used by the public API: Roman numerals for MegaBrawl
// names, and weight-class divisions for the fighters directory.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toRoman, megaBrawlName } from '../src/lib/seasons.ts';
import { divisionOf, FEMALE_DIVISION_CLASSES } from '../src/lib/fighters.ts';

test('Roman numerals', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(5), 'V');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(14), 'XIV');
  assert.equal(toRoman(40), 'XL');
  assert.equal(toRoman(1999), 'MCMXCIX');
  assert.equal(toRoman(0), '0');
  assert.equal(toRoman(2.5), '2.5');
});

test('MegaBrawl name follows the season number', () => {
  assert.equal(megaBrawlName({ number: 4 }), 'MegaBrawl IV');
  assert.equal(megaBrawlName({ number: 5 }), 'MegaBrawl V');
});

test('women in split classes get their own division', () => {
  assert.equal(divisionOf('Featherweight', 'Female'), 'Female Featherweight');
  assert.equal(divisionOf('Featherweight', 'Male'), 'Featherweight');
  assert.equal(divisionOf('Featherweight', ''), 'Featherweight');
  assert.equal(divisionOf('Welterweight', 'Female'), 'Welterweight');
  assert.equal(divisionOf('', 'Female'), '');
  assert.deepEqual([...FEMALE_DIVISION_CLASSES].sort(), ['Bantamweight', 'Featherweight', 'Super Lightweight']);
});
