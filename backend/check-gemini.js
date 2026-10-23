// Run: npm run check:gemini   — verifies your GEMINI_API_KEY works end to end (never prints the key)
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const gemini = require('./gemini');
const { analyzeDemo } = require('./analysis');

(async () => {
  console.log(`Key configured : ${gemini.enabled() ? 'yes' : 'NO (set GEMINI_API_KEY in backend/.env)'}`);
  console.log(`Model          : ${gemini.MODEL()}`);
  const a = analyzeDemo('ransomware');

  const r = await gemini.explain(a, { audience: 'simple', language: 'en' });
  console.log(`\nExplain source : ${r.source}${r.note ? `  (${r.note})` : ''}`);
  console.log(`Headline       : ${r.explanation.headline}`);
  console.log(`TL;DR          : ${r.explanation.tldr}`);
  console.log(`Story steps    : ${r.explanation.story.length}, next steps: ${r.explanation.nextSteps.length}`);

  const c = await gemini.chat(a, 'In two sentences, where did the money end up?', []);
  console.log(`\nChat source    : ${c.source}`);
  console.log(`Answer         : ${c.answer}`);

  const ok = r.source === 'gemini' && c.source === 'gemini';
  console.log(`\n${ok ? 'PASS: Gemini is working.' : 'Gemini was NOT used. See the error lines above (HTTP status / model name).'}`);
  process.exit(ok ? 0 : 1);
})();
