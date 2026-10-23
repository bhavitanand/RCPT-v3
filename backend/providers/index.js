const evm = require('./evm');
const bitcoin = require('./bitcoin');
const solana = require('./solana');
const tron = require('./tron');

const BY_FAMILY = { evm, utxo: bitcoin, solana, tron };

function fetchAddress(chain, address, opts) {
  return BY_FAMILY[chain.family].fetchAddress(chain, address, opts);
}

// Which chains can run right now (used by /api/health so the UI can be honest)
function availability() {
  return {
    evm: !!process.env.ETHERSCAN_API_KEY,
    utxo: true,
    solana: true,
    tron: true,
  };
}

module.exports = { fetchAddress, availability, evm };
