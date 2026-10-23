const test = require('node:test');
const assert = require('node:assert/strict');
const { pickTransfers } = require('../providers/solana');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const tx = (ix, balances) => ({
  transaction: { message: { accountKeys: [{ pubkey: 'ATA_A' }, { pubkey: 'ATA_B' }], instructions: ix } },
  meta: { preTokenBalances: balances, postTokenBalances: [], innerInstructions: [] },
});
const bal = [
  { accountIndex: 0, owner: 'OWNER_A', mint: USDC, uiTokenAmount: { decimals: 6 } },
  { accountIndex: 1, owner: 'OWNER_B', mint: USDC, uiTokenAmount: { decimals: 6 } },
];

test('SPL transfer resolves token accounts to wallet owners', () => {
  const r = pickTransfers(tx([{ program: 'spl-token', parsed: { type: 'transfer', info: { source: 'ATA_A', destination: 'ATA_B', amount: '2500000' } } }], bal), 'sig', 1000);
  assert.deepEqual(r.map(({ from, to, amount, symbol, token }) => ({ from, to, amount, symbol, token })), [
    { from: 'OWNER_A', to: 'OWNER_B', amount: 2.5, symbol: 'USDC', token: 'USDC' },
  ]);
});

test('transferChecked uses the stated decimals; unknown mints get a neutral symbol', () => {
  const r = pickTransfers(tx([{ program: 'spl-token', parsed: { type: 'transferChecked', info: { source: 'ATA_A', destination: 'ATA_B', mint: 'ZzzzMint', tokenAmount: { decimals: 9, uiAmountString: '1.5' } } } }], bal), 'sig', 1000);
  assert.equal(r[0].amount, 1.5);
  assert.equal(r[0].symbol, 'SPL-Zzzz');
});

test('transfers with unknown token-account owners are skipped', () => {
  const r = pickTransfers(tx([{ program: 'spl-token', parsed: { type: 'transfer', info: { source: 'ATA_A', destination: 'NOPE', amount: '1' } } }], bal), 'sig', 1000);
  assert.equal(r.length, 0);
});
