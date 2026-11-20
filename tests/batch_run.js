// Round 3 "handling more load": send 5 different inputs to the LIVE n8n, collect a results table.
//   node tests/batch_run.js            -> back to back (one after another, the intended pilot pattern)
//   node tests/batch_run.js burst      -> all 5 submitted at the same moment
// Output: tests/batch/r3_batch_<mode>.json / .md / .html. Nothing is invented: every number comes from the run itself and the audit log.
const fs = require('fs'), path = require('path'), os = require('os');
const w = require('../ecoshield_workflow.json');
const C = require('../core.js');
const formId = w.nodes.find(n => /Console form/.test(n.name)).webhookId;
const FORM = 'http://localhost:5678/form/' + formId;
const AUDIT = path.join(os.homedir(), '.n8n-files', 'ecoshield_audit.jsonl');
const OUT = path.join(__dirname, 'batch'); fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] === 'burst' ? 'burst' : 'back_to_back';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const COLS = ['day', 'hour', 'water_lph', 'kwh', 'occupied', 'outdoor_c', 'setpoint_c'];
const toCsv = (rows) => COLS.join(',') + '\n' + rows.map(r => COLS.map(c => r[c] === null || r[c] === undefined ? '' : r[c]).join(',')).join('\n') + '\n';
const csvOf = (id) => toCsv(C.get_local_meter_and_occupancy(id).rows);
const label = (id) => id + ' - ' + C.ALL_SCENARIOS.find(s => s.id === id).name;
const RESET = 'RESET - clear the demo memory';
const get = async (url) => { try { return await (await fetch(url, { signal: AbortSignal.timeout(25000) })).text(); } catch (e) { return ''; } };
const post = async (url, fields) => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v)); return (await fetch(url, { method: 'POST', body: f })).text(); };
async function submit(fields, csv, name) {
  const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  if (csv !== undefined) f.append('field-5', new Blob([csv], { type: 'text/csv' }), name || 'meter.csv');
  return JSON.parse(await (await fetch(FORM, { method: 'POST', body: f })).text());
}
async function finish(W, deadlineMs) {
  let page = '', asked = false; const t0 = Date.now(); await sleep(7000);
  while (Date.now() - t0 < deadlineMs) {
    page = await get(W); if (!page) { await sleep(2000); continue; }
    if (/Audit trail/.test(page) || /memory reset/.test(page)) return { page, asked, done: true };
    if (/name="field-1"/.test(page) || /Human approval needed/.test(page)) { asked = true; await post(W, { 'field-0': 'Approve', 'field-1': 'Akash', 'field-2': 'batch run' }); await sleep(4000); } else await sleep(2000);
  }
  return { page, asked, done: false };
}
const INPUTS = [
  { id: 'B1', name: 'Leak in an uploaded meter file', fields: { 'field-0': label(1) }, csv: () => csvOf(1), file: 'leak_week.csv', expect: 'LEAK, human approves, valve closed' },
  { id: 'B2', name: 'Normal month file, setpoint 23 C', fields: { 'field-0': label(2) }, csv: () => csvOf(2), file: 'normal_month.csv', expect: 'NO_LEAK, human approves' },
  { id: 'B3', name: 'Corrupt meter file', fields: { 'field-0': label(12) }, csv: () => csvOf(12), file: 'corrupt_feed.csv', expect: 'not trusted, nothing acted on' },
  { id: 'B4', name: 'Prompt injection in an operator note', fields: { 'field-0': label(11) }, csv: null, expect: 'rejected before any AI' },
  { id: 'B5', name: 'Leak file while the cloud AI is down (drill)', fields: { 'field-0': label(1), 'field-7': 'Groq outage: make the cloud AI calls fail on purpose' }, csv: () => csvOf(1), file: 'leak_week.csv', expect: 'same safe result using the fallback chain', resetBefore: true }
];
function runInfo(runId) {
  const ev = fs.readFileSync(AUDIT, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(e => e && e.run_id === runId);
  const ex = ev.find(e => e.step === 'explain'), plans = ev.filter(e => e.step === 'plan_step'), t = (x) => Date.parse(x.ts);
  const tin = plans.reduce((a, e) => a + (e.detail.tokens_in || 0), 0) + (ex ? ex.detail.tokens_in || 0 : 0), tout = plans.reduce((a, e) => a + (e.detail.tokens_out || 0), 0) + (ex ? ex.detail.tokens_out || 0 : 0);
  const planProviders = plans.filter(e => e.actor === 'llm').map(e => (e.detail.by.match(/\(([^)]+)\)/) || [])[1] || 'fixed order');
  return { events: ev.length, explain_provider: ex ? ex.detail.provider_answered : 'none (no AI call)', plan_llm_calls: plans.filter(e => e.actor === 'llm').length, plan_providers: planProviders, tokens_in: tin, tokens_out: tout, tokens: tin + tout, wrote: ev.some(e => e.step === 'write_gateway' && e.detail.ok === true), drill: ev.some(e => e.step === 'failure_drill') };
}
async function one(inp) {
  const t0 = Date.now();
  const j = await submit(inp.fields, inp.csv ? inp.csv() : undefined, inp.file);
  const r = await finish(j.formWaitingUrl, 8 * 60 * 1000), secs = Math.round((Date.now() - t0) / 1000);
  const runId = (r.page.match(/ES-[A-Z0-9]{6,}/) || [])[0] || null;
  const verdict = (r.page.match(/<div class="big"><span class="pill [a-z]+">([A-Z_]+)</) || [])[1] || 'NOT_RUN';
  const rule = (r.page.match(/rule <span class="mono">([a-z_]+)</) || [])[1] || '';
  const banner = ((r.page.match(/class="banner [a-z]+">([^<]*)</) || [])[1] || '').replace(/&[a-z]+;/g, '');
  const info = runId ? runInfo(runId) : {};
  return Object.assign({ id: inp.id, input: inp.name, expected: inp.expect, completed: r.done, seconds: secs, verdict, rule, outcome: banner, approval_asked: r.asked, run_id: runId }, info);
}
(async () => {
  let j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, 60000);
  const t0 = Date.now(); let res = [];
  if (mode === 'burst') res = await Promise.all(INPUTS.map(one)); else for (const inp of INPUTS) { if (inp.resetBefore) { const rj = await submit({ 'field-0': RESET }); await finish(rj.formWaitingUrl, 60000); } res.push(await one(inp)); }
  const total = Math.round((Date.now() - t0) / 1000);
  const done = res.filter(x => x.completed), secs = done.map(x => x.seconds).sort((a, b) => a - b);
  const med = secs.length ? secs[Math.floor(secs.length / 2)] : null;
  const summary = { mode, sent: res.length, completed: done.length, total_seconds: total, median_seconds: med, slowest_seconds: secs.length ? secs[secs.length - 1] : null, failures_handled: res.filter(x => x.drill || /upload_rejected|injection|untrusted/.test(x.rule)).length, started: new Date(t0).toISOString() };
  fs.writeFileSync(path.join(OUT, `r3_batch_${mode}.json`), JSON.stringify({ summary, results: res }, null, 2));
  const md = ['# Round 3 batch run (' + mode + ')', '', `Sent ${summary.sent}, completed ${summary.completed}, total ${summary.total_seconds}s, median ${summary.median_seconds}s, slowest ${summary.slowest_seconds}s.`, '',
    '| # | Input | Time (s) | Verdict | Rule | Outcome | AI that answered | Tokens | Run ID |', '|---|---|---|---|---|---|---|---|---|']
    .concat(res.map(x => `| ${x.id} | ${x.input} | ${x.seconds} | ${x.verdict} | ${x.rule || '-'} | ${x.outcome || '-'} | ${x.explain_provider} | ${x.tokens || 0} | ${x.run_id} |`));
  fs.writeFileSync(path.join(OUT, `r3_batch_${mode}.md`), md.join('\n') + '\n');
  console.log(md.join('\n'));
  console.log(JSON.stringify(summary));
  j = await submit({ 'field-0': RESET }); await finish(j.formWaitingUrl, 60000);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
