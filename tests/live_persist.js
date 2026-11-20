// Drives the LIVE local n8n (real Groq, real planner loop, real static-data memory). Run: node tests/live_run.js [scenarioIds e.g. 1,6]
const fs = require('fs'), path = require('path');
const w = require('../ecoshield_workflow.json');
const C = require('../core.js');
const formId = w.nodes.find(n => /Console form/.test(n.name)).webhookId;
const FORM = 'http://localhost:5678/form/' + formId, DASH = 'http://localhost:5678/webhook/ecoshield-dashboard';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const post = async (url, fields) => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v)); return (await fetch(url, { method: 'POST', body: f })).text(); };
const get = async (url) => { try { return await (await fetch(url, { signal: AbortSignal.timeout(25000) })).text(); } catch (e) { return ''; } };
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const label = (id) => id + ' - ' + C.ALL_SCENARIOS.find(s => s.id === id).name;
const UNDO = 'UNDO - roll back the last applied change', RESET = 'RESET - clear the demo memory';
async function runOne(sel, reviewer, decision, note) {
  const t0 = Date.now(); const j = JSON.parse(await post(FORM, { 'field-0': sel, 'field-1': note || '' })); const W = j.formWaitingUrl;
  let page = '', asked = false; await sleep(7000);   // a GET on a still-running execution hangs, so give the loop time first
  for (let i = 0; i < 90; i++) {
    page = await get(W); if (!page) { await sleep(2000); continue; }
    if (/Audit trail/.test(page) || /memory reset/.test(page)) break;
    if (/name="field-1"/.test(page) || /Human approval needed/.test(page)) { asked = true; await post(W, { 'field-0': decision || 'Approve', 'field-1': reviewer }); await sleep(4000); } else await sleep(2000);
  }
  return { page, asked, secs: Math.round((Date.now() - t0) / 1000) };
}
const grab = (page, re) => (page.match(re) || [])[1];
(async () => {
  const seq = [RESET, '1 - Overnight hidden pipe leak'];
  for (const sel of seq) { const r = await runOne(sel, 'Akash'); require('fs').writeFileSync('tests/live/u_' + sel.slice(0, 4).trim() + '.html', r.page); console.log(sel.slice(0, 20), '|', grab(r.page, /class="banner [a-z]+">([^<]*)</), '|', (r.page.match(/Building state after this run:[\s\S]*?<\/p>/) || [''])[0].replace(/<[^>]+>/g, '')); }
  process.exit(0);
})();
