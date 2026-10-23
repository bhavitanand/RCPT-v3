const test = require('node:test');
const assert = require('node:assert/strict');
const { extract } = require('../extract');
const { linkedWallets } = require('../analysis');

test('extract finds addresses and tx hashes in a ransom note', () => {
  const note = `Your files are encrypted. Send 0.5 BTC to 13AM4VW2dhxYgXeQepoHkHSQuy6NgaEb94 or
    pay USDT to TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t. Receipt: ${'ab'.repeat(32)} and 0x${'cd'.repeat(32)}. Contact us: bhavit@example.com`;
  const r = extract(note);
  assert.deepEqual(r.addresses.map(a => a.address).sort(), ['13AM4VW2dhxYgXeQepoHkHSQuy6NgaEb94', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'].sort());
  assert.equal(r.hashes.length, 2);
  assert.ok(r.hashes.some(h => h.kind === 'evm') && r.hashes.some(h => h.kind === 'hex64'));
});

test('extract ignores ordinary words and handles empty input', () => {
  assert.deepEqual(extract('hello world, nothing to see here'), { addresses: [], hashes: [] });
  assert.deepEqual(extract(undefined), { addresses: [], hashes: [] });
});

test('linked wallets follow chains of co-spending', () => {
  const l = linkedWallets('A', [['A', 'B'], ['B', 'C'], ['X', 'Y']]);
  assert.deepEqual(l.addresses.sort(), ['B', 'C']);
  assert.equal(linkedWallets('A', [['X', 'Y']]), null);
  assert.equal(linkedWallets('A', []), null);
});
