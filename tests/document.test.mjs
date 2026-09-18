import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot, matchChildren, writeDocument } from '../src/editor/document.ts';

test('imports minimal nodes without mutating source; rejects broken documents', () => {
  const source = { text: '主题', children: [{ text: '内容', x: Infinity }] };
  const root = normalizeRoot(source);
  assert.equal(root.children[0].x, 0);
  assert.equal(root.children[0].children.length, 0);
  assert.equal(source.id, undefined);
  for (const invalid of [null, 42, [], {}, { text: 3 }, { text: 'x', children: {} }]) {
    assert.throws(() => normalizeRoot(invalid));
  }
  const cycle = { text: 'cycle', children: [] }; cycle.children.push(cycle);
  assert.throws(() => normalizeRoot(cycle));
});

test('imports enforce depth and count limits before recursive rendering', () => {
  const root = { text: 'root', children: [] }; let node = root;
  for (let i = 0; i < 102; i++) { const child = { text: 'x', children: [] }; node.children.push(child); node = child; }
  assert.throws(() => normalizeRoot(root));
  assert.throws(() => normalizeRoot({ text: 'root', children: Array.from({ length: 5000 }, () => ({ text: 'x' })) }));
});

test('inserting/reordering siblings does not steal identities and flow edges', () => {
  const a = { text: 'A', id: 'a' }; const b = { text: 'B', id: 'b' };
  assert.deepEqual(matchChildren([{ text: 'new' }, a, b], [a, b]), [null, a, b]);
  assert.deepEqual(matchChildren([b, a], [a, b]), [b, a]);
  assert.deepEqual(matchChildren([{ text: 'renamed' }, b], [a, b]), [a, b]);
  assert.deepEqual(matchChildren([b], [a, b]), [b]);
});

test('quota and storage failures are reported without deleting existing data', () => {
  const writes = [];
  assert.equal(writeDocument({ setItem: (...args) => writes.push(args) }, 'key', { text: '中文' }), true);
  assert.deepEqual(JSON.parse(writes[0][1]), { text: '中文' });
  assert.equal(writeDocument({ setItem: () => { throw new Error('QuotaExceededError'); } }, 'key', {}), false);
});
