import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePartialBreakdown } from './api';

test('empty buffer returns empty arrays', () => {
  const out = parsePartialBreakdown('');
  assert.deepEqual(out.mains, []);
  assert.deepEqual(out.subs, []);
});

test('pre-anchor reasoning text yields nothing', () => {
  const out = parsePartialBreakdown('Here is the answer:\n');
  assert.deepEqual(out.mains, []);
  assert.deepEqual(out.subs, []);
});

test('mid-mains array: extracts complete strings, no subs', () => {
  const buf = '{ "mains": ["one", "two", "three"';
  const out = parsePartialBreakdown(buf);
  assert.deepEqual(out.mains, ['one', 'two', 'three']);
  assert.deepEqual(out.subs, []);
});

test('mid-mains array: partial trailing string is NOT emitted', () => {
  const buf = '{ "mains": ["one", "two", "thr';
  const out = parsePartialBreakdown(buf);
  assert.deepEqual(out.mains, ['one', 'two']);
});

test('complete mains + partial subs: 8 mains, fewer subs', () => {
  const mains = Array.from({ length: 8 }, (_, i) => `m${i}`);
  const fullRow = (i: number) => Array.from({ length: 8 }, (_, j) => `s${i}-${j}`);
  const buf =
    '{ "mains": ' +
    JSON.stringify(mains) +
    ', "subs": [' +
    JSON.stringify(fullRow(0)) +
    ',' +
    JSON.stringify(fullRow(1)) +
    ',' +
    JSON.stringify(fullRow(2)) +
    ',["s3-0","s3-1","s3-2"';
  const out = parsePartialBreakdown(buf);
  assert.equal(out.mains.length, 8);
  assert.equal(out.subs.length, 3, 'partial row must not be emitted');
  assert.deepEqual(out.subs[0], fullRow(0));
  assert.deepEqual(out.subs[1], fullRow(1));
  assert.deepEqual(out.subs[2], fullRow(2));
});

test('does NOT pad partial arrays to 8', () => {
  const buf = '{ "mains": ["a"], "subs": [["x"]]';
  const out = parsePartialBreakdown(buf);
  assert.equal(out.mains.length, 1);
  assert.equal(out.subs.length, 1);
  assert.equal(out.subs[0].length, 1);
});

test('handles escaped quotes inside strings', () => {
  const buf = '{ "mains": ["she said \\"hi\\"", "next"';
  const out = parsePartialBreakdown(buf);
  assert.deepEqual(out.mains, ['she said "hi"', 'next']);
});

test('handles escaped backslash inside strings', () => {
  const buf = '{ "mains": ["path\\\\to\\\\file"';
  const out = parsePartialBreakdown(buf);
  assert.deepEqual(out.mains, ['path\\to\\file']);
});

test('complete output: 8 mains and 8 rows of 8', () => {
  const mains = Array.from({ length: 8 }, (_, i) => `m${i}`);
  const subs = Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: 8 }, (_, j) => `s${i}-${j}`),
  );
  const buf = JSON.stringify({ mains, subs });
  const out = parsePartialBreakdown(buf);
  assert.equal(out.mains.length, 8);
  assert.equal(out.subs.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.equal(out.subs[i].length, 8);
    assert.equal(out.subs[i][0], `s${i}-0`);
  }
});

test('whitespace and newlines between rows are tolerated', () => {
  const buf =
    '{\n  "mains": [\n    "a",\n    "b"\n  ],\n  "subs": [\n    ["x", "y"],\n    ["p", "q"]\n  ]';
  const out = parsePartialBreakdown(buf);
  assert.deepEqual(out.mains, ['a', 'b']);
  assert.equal(out.subs.length, 2);
  assert.deepEqual(out.subs[0], ['x', 'y']);
  assert.deepEqual(out.subs[1], ['p', 'q']);
});
