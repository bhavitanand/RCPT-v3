// Small axios wrapper with timeout + retry on 429/5xx
const axios = require('axios');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function request(config, { retries = 2, timeout = 12000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios({ timeout, ...config });
    } catch (err) {
      lastErr = err;
      const status = err.response && err.response.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt === retries) break;
      await sleep(600 * (attempt + 1));
    }
  }
  const status = lastErr.response && lastErr.response.status;
  const e = new Error(
    status === 429 ? 'The data provider is rate-limiting us. Wait a moment and try again.'
    : status === 404 ? 'The data provider has no record of this address.'
    : `Could not reach the data provider (${lastErr.code || status || 'network error'}).`
  );
  e.status = status || 502;
  throw e;
}

module.exports = { request, sleep };
