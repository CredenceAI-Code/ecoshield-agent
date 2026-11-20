// Quota stress: runs every scenario back to back (no pauses, no resets between) for N rounds on the live n8n and reports which model answered.
// Run: node tests/quota_run.js [rounds]. Needs n8n running with the normal (Groq + Ollama) workflow published.
const fs = require('fs'), path = require('path');
const w = require('../ecoshield_workflow.json'), C = require('../core.js');
const formId = w.nodes.find(n => /Console form/.test(n.name)).webhookId, FORM = 'http://localhost:5678/form/' + formId;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const post = async (url, f) => { const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); return (await fetch(url, { method: 'POST', body: fd })).text(); };
const get = async (u) => { try { return await (await fetch(u, { signal: AbortSignal.timeout(25000) })).text(); } catch (e) { return ''; } };
async function runOne(sel) {
  const t0 = Date.now(), j = JSON.parse(await post(FORM, { 'field-0': sel, 'field-1': '' })), W = j.formWaitingUrl; let page = ''; await sleep(7000);
  for (let i = 0; i < 90; i++) {
    page = await get(W); if (!page) { await sleep(2000); continue; }
    if (/Audit trail/.test(page)) break;
    if (/name="field-1"/.test(page) || /Human approval needed/.test(page) || /Human review/.test(page)) { await post(W, { 'field-0': /could not find a safe plan/.test(page) ? 'Acknowledge: keep current settings' : 'Approve', 'field-1': 'Akash' }); await sleep(4000); } else await sleep(2000);
  }
  return { page, secs: Math.round((Date.now() - t0) / 1000) };
}
(async () => {
  const rounds = parseInt(process.argv[2] || '3', 10), t0 = new Date(); const tot = { plan_main: 0, plan_20b: 0, plan_ollama: 0, plan_fixed: 0, ex_main: 0, ex_20b: 0, ex_ollama: 0, ex_template: 0, tokens: 0, runs: 0, secs: 0 };
  await runOne('RESET - clear the demo memory');
  for (let k = 1; k <= rounds; k++) for (const s of C.ALL_SCENARIOS) {
    const r = await runOne(s.id + ' - ' + s.name), p = r.page, n = (re) => (p.match(re) || []).length;
    tot.plan_main += n(/AI planner \(groq\)/g); tot.plan_20b += n(/AI planner \(groq-20b\)/g); tot.plan_ollama += n(/AI planner \(ollama\)/g); tot.plan_fixed += n(/fixed order \(no AI planner answered\)/g);
    const w = (p.match(/Written by (Groq gpt-oss-120b|Groq gpt-oss-20b|Ollama)/) || [])[1];
    if (w === 'Groq gpt-oss-120b') tot.ex_main++; else if (w === 'Groq gpt-oss-20b') tot.ex_20b++; else if (w === 'Ollama') tot.ex_ollama++; else if (/No AI text used/.test(p)) tot.ex_template++;
    tot.tokens += +((p.match(/&middot; (\d+) tokens/) || [])[1] || 0); tot.runs++; tot.secs += r.secs;
    console.log(`round ${k} S${s.id} ${r.secs}s explain: ${w || (/No AI text used/.test(p) ? 'template' : 'n/a (no AI call)')}`);
  }
  await runOne('RESET - clear the demo memory');
  console.log('\nSTARTED', t0.toISOString(), 'FINISHED', new Date().toISOString());
  console.log(JSON.stringify(tot));
})().catch(e => { console.log('CRASH', e); process.exit(1); });
