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
  const only = process.argv[2];
  let j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, true);
  if (!only || only === 'upload') {
    console.log('-- live: upload a leak meter file under the scenario-1 request');
    const t0 = Date.now(); j = await submit({ 'field-0': label(1) }, toCsv(C.get_local_meter_and_occupancy(1).rows), 'leak_week.csv');
    const r = await finish(j.formWaitingUrl, true); const secs = Math.round((Date.now() - t0) / 1000);
    okk(/LEAK/.test(r.page) && /Approved by Akash and applied/.test(r.page), 'uploaded leak file -> LEAK, approved and applied (' + secs + 's)');
    const m = auditFor(e => e.step === 'meter_file' && e.detail.source === 'uploaded_file' && e.detail.filename === 'leak_week.csv').pop();
    okk(!!m && m.detail.rows > 400, 'audit log has the meter_file line: ' + (m ? m.run_id + ' ' + JSON.stringify(m.detail) : 'MISSING'));
    j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, true);
    console.log('-- live: a bad file is rejected before any AI');
    j = await submit({ 'field-0': label(1) }, 'day,hour\n1,2\n', 'bad.csv'); const r2 = await finish(j.formWaitingUrl, true);
    okk(/upload_rejected/.test(r2.page) || /rejected/i.test(r2.page), 'bad file rejected on the live n8n');
    const rj = auditFor(e => e.step === 'meter_file' && e.detail.rejected).pop(); okk(!!rj, 'rejection logged: ' + (rj ? rj.run_id + ' ' + rj.detail.reason : 'MISSING'));
  }
  if (!only || only === 'timeout') {
    console.log('-- live: approval wait limit (1 minute): nobody answers');
    j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, true);
    const t0 = Date.now(); j = await submit({ 'field-0': label(1), 'field-6': 1 });
    const r = await finish(j.formWaitingUrl, false); okk(r.asked, 'approval form was shown and left unanswered');
    let to = null;
    for (let i = 0; i < 60 && !to; i++) { await sleep(5000); to = auditFor(e => e.step === 'approval_timeout' && Date.parse(e.ts) > t0).pop(); }
    okk(!!to, 'approval_timeout line appeared in the audit log after ' + Math.round((Date.now() - t0) / 1000) + 's: ' + (to ? to.run_id + ' ' + JSON.stringify(to.detail) : 'MISSING'));
    if (to) {
      const ev = auditFor(e => e.run_id === to.run_id);
      const wg = ev.find(e => e.step === 'write_gateway');
      okk(wg && wg.detail.skipped === true, 'write gateway skipped on timeout');
      okk(!ev.some(e => e.step === 'write_gateway' && e.detail.ok === true), 'nothing was written');
    }
    j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, true);
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
