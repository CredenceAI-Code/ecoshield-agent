// LIVE Round 3 checks against the running local n8n: real CSV upload, real wait-limit timeout. Run: node tests/live_r3.js [timeout]
const fs = require('fs'), path = require('path'), os = require('os');
const w = require('../ecoshield_workflow.json');
const C = require('../core.js');
const formId = w.nodes.find(n => /Console form/.test(n.name)).webhookId;
const FORM = 'http://localhost:5678/form/' + formId;
const AUDIT = path.join(os.homedir(), '.n8n-files', 'ecoshield_audit.jsonl');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const okk = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const COLS = ['day', 'hour', 'water_lph', 'kwh', 'occupied', 'outdoor_c', 'setpoint_c'];
const toCsv = (rows) => COLS.join(',') + '\n' + rows.map(r => COLS.map(c => r[c] === null || r[c] === undefined ? '' : r[c]).join(',')).join('\n') + '\n';
const label = (id) => id + ' - ' + C.ALL_SCENARIOS.find(s => s.id === id).name;
const RESET = 'RESET - clear the demo memory';
const get = async (url) => { try { return await (await fetch(url, { signal: AbortSignal.timeout(25000) })).text(); } catch (e) { return ''; } };
async function submit(fields, csv, name) {
  const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  if (csv !== undefined) f.append('field-5', new Blob([csv], { type: 'text/csv' }), name || 'meter.csv');
  return JSON.parse(await (await fetch(FORM, { method: 'POST', body: f })).text());
}
const post = async (url, fields) => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v)); return (await fetch(url, { method: 'POST', body: f })).text(); };
async function finish(W, answer) {   // poll the waiting URL until the result page; answer the approval form if shown
  let page = ''; await sleep(7000);
  for (let i = 0; i < 90; i++) {
    page = await get(W); if (!page) { await sleep(2000); continue; }
    if (/Audit trail/.test(page) || /memory reset/.test(page)) break;
    if (/name="field-1"/.test(page) || /Human approval needed/.test(page)) { if (!answer) return { page, asked: true }; await post(W, { 'field-0': 'Approve', 'field-1': 'Akash' }); await sleep(4000); } else await sleep(2000);
  }
  return { page, asked: false };
}
const auditFor = (pred) => fs.readFileSync(AUDIT, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(e => e && pred(e));
(async () => {
  await sleep(15000);
  let j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, true);
  for (const sc of [1, 4]) {
    const t0 = Date.now(); j = await submit({ 'field-0': label(sc) }, sc === 1 ? toCsv(C.get_local_meter_and_occupancy(1).rows) : undefined, 'leak_week.csv');
    const r = await finish(j.formWaitingUrl, true);
    const ev = auditFor(e => Date.parse(e.ts) >= t0 && (e.step === 'evidence_review' || e.step === 'autonomy_level'));
    console.log('scenario', sc, 'secs', Math.round((Date.now() - t0) / 1000), 'page has AI second opinion:', /AI second opinion/.test(r.page));
    ev.forEach(e => console.log('  ', e.step, JSON.stringify(e.detail).slice(0, 400)));
    okk(ev.some(e => e.step === 'evidence_review' && e.detail.level) && ev.some(e => e.step === 'autonomy_level' && e.detail.ai_level), 'scenario ' + sc + ': AI level and combined level both logged');
    j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, true);
  }
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
