const test = require('node:test');
const assert = require('node:assert/strict');

const { detectChains, resolveChain } = require('../chains');
const { analyzeDemo } = require('../analysis');
const { offlineExplanation } = require('../gemini');
const { noisyOr } = require('../detection');
const b58 = require('../lib/base58');

test('address detection across networks', () => {
  assert.deepEqual(detectChains('13AM4VW2dhxYgXeQepoHkHSQuy6NgaEb94'), ['bitcoin']);
  assert.deepEqual(detectChains('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), ['bitcoin']);
  assert.ok(detectChains('0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc').includes('ethereum'));
  assert.deepEqual(detectChains('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'), ['tron']);
  assert.deepEqual(detectChains('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'), ['solana']);
  assert.deepEqual(detectChains('not-an-address'), []);
});

test('requested network must match the address', () => {
  assert.ok(resolveChain('0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc', 'bitcoin').error);
  assert.equal(resolveChain('0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc', 'base').chain.id, 'base');
});

test('base58check round-trips', () => {
  const body = Buffer.concat([Buffer.from([0x41]), Buffer.alloc(20, 7)]);
  assert.deepEqual(b58.decodeCheck(b58.encodeCheck(body)).version, 0x41);
});

test('noisy-or stays bounded and monotonic', () => {
  assert.equal(noisyOr([]), 0);
  assert.equal(noisyOr([100, 50]), 100);
  assert.ok(noisyOr([25, 25]) > 25 && noisyOr([25, 25]) < 50);
});

test('ransomware demo is high risk with the expected patterns', () => {
  const a = analyzeDemo('ransomware');
  assert.equal(a.meta.source, 'demo');
  assert.ok(a.verdict.score >= 70, `score ${a.verdict.score}`);
  const types = new Set(a.flags.map(f => f.type));
  for (const t of ['consolidation', 'chaining', 'label_exposure', 'exchange_exposure']) assert.ok(types.has(t), `missing ${t}`);
  assert.ok(a.flags.every(f => f.plain && Array.isArray(f.evidence)));
  assert.ok(a.outflow.mixer > 0 && a.outflow.exchange > 0);
});

test('peel chain demo detects a peel chain', () => {
  const a = analyzeDemo('peel');
  assert.ok(a.flags.some(f => f.type === 'peel_chain'));
});

test('ordinary demo stays low risk', () => {
  const a = analyzeDemo('ordinary');
  assert.ok(a.verdict.score < 40, `score ${a.verdict.score}`);
});

test('offline explanation has the full shape', () => {
  const e = offlineExplanation(analyzeDemo('ransomware'));
  assert.ok(e.headline && e.tldr && e.story.length && e.nextSteps.length && e.caveats.length);
});

test('graph edges carry timestamped events', () => {
  const a = analyzeDemo('ransomware');
  assert.ok(a.graph.edges.every(e => e.events.length && e.events[0].ts));
  assert.ok(a.graph.nodes.some(n => n.isTarget));
});
