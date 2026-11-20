// Computes the Round 3 numbers from the REAL audit log. Nothing typed in by hand except the Groq price list below (fetched 2026-11-21).
//   node tests/measure_r3.js <since-ISO>     e.g. node tests/measure_r3.js 2026-11-21T01:30:00Z
// Writes data/round3_measurements.json and data/round3_measurements.md
const fs = require('fs'), path = require('path'), os = require('os');
const since = Date.parse(process.argv[2] || '1970-01-01');
const AUDIT = path.join(os.homedir(), '.n8n-files', 'ecoshield_audit.jsonl');
// Groq published prices, USD per 1M tokens, from console.groq.com/docs/models, read 2026-11-21 (page undated). Cached-input price not published.
const PRICE = { 'groq': { in: 0.15, out: 0.60, model: 'openai/gpt-oss-120b' }, 'groq-20b': { in: 0.075, out: 0.30, model: 'openai/gpt-oss-20b' } };
const ev = fs.readFileSync(AUDIT, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(e => e && Date.parse(e.ts) >= since);
const runs = {}; ev.forEach(e => { (runs[e.run_id] = runs[e.run_id] || []).push(e); });
const T = (e) => Date.parse(e.ts);
const rows = [];
Object.keys(runs).forEach(id => {
  const r = runs[id].sort((a, b) => T(a) - T(b));
  const ex = r.find(e => e.step === 'explain'); if (!ex || ex.detail.tokens_in === undefined) return;   // only runs on the build that logs the in/out split
  if (r.some(e => e.step === 'failure_drill')) return;                                                      // drill runs are reported separately
  const plans = r.filter(e => e.step === 'plan_step' && e.actor === 'llm');
  let tin = 0, tout = 0, cost = 0;
  const add = (prov, a, b) => { tin += a || 0; tout += b || 0; const p = PRICE[prov]; if (p) cost += ((a || 0) * p.in + (b || 0) * p.out) / 1e6; };
  plans.forEach(e => { const prov = /groq-20b/.test(e.detail.by) ? 'groq-20b' : /\(groq\)/.test(e.detail.by) ? 'groq' : 'local'; add(prov, e.detail.tokens_in, e.detail.tokens_out); });
  add(ex.detail.provider_answered, ex.detail.tokens_in, ex.detail.tokens_out);
  const appr = r.find(e => e.step === 'approval'), last = r[r.length - 1], first = r[0];
  let machine = (T(last) - T(first)) / 1000;
  if (appr) { const before = r.filter(e => T(e) < T(appr) && e.step !== 'approval').pop(); machine = (T(before) - T(first)) / 1000 + (T(last) - T(appr)) / 1000; }
  rows.push({ run_id: id, provider: ex.detail.provider_answered, ai_calls: plans.length + 1, tokens_in: tin, tokens_out: tout, cost_usd: cost, machine_seconds: machine, approval: !!appr });
});
const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null;
const pct = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : null;
const groqRows = rows.filter(r => r.provider === 'groq' || r.provider === 'groq-20b');
const m = {
  generated: new Date().toISOString(), since: process.argv[2] || null, runs_counted: rows.length, runs_by_provider: rows.reduce((o, r) => (o[r.provider] = (o[r.provider] || 0) + 1, o), {}),
  prices_usd_per_million: PRICE, price_source: 'console.groq.com/docs/models, read 2026-11-21, page undated; cached-input price not published',
  tokens_per_request: { median_in: med(rows.map(r => r.tokens_in)), median_out: med(rows.map(r => r.tokens_out)), median_total: med(rows.map(r => r.tokens_in + r.tokens_out)), p95_total: pct(rows.map(r => r.tokens_in + r.tokens_out), .95), max_total: Math.max.apply(null, rows.map(r => r.tokens_in + r.tokens_out)) },
  ai_calls_per_request: { median: med(rows.map(r => r.ai_calls)), max: Math.max.apply(null, rows.map(r => r.ai_calls)) },
  cost_usd_per_request: { median: med(groqRows.map(r => r.cost_usd)), p95: pct(groqRows.map(r => r.cost_usd), .95), max: groqRows.length ? Math.max.apply(null, groqRows.map(r => r.cost_usd)) : null, note: 'cloud calls only; local-model calls cost nothing; every run that used Groq is counted at the price of the Groq model that answered' },
  latency_machine_seconds: { median: med(rows.map(r => r.machine_seconds)), p95: pct(rows.map(r => r.machine_seconds), .95), max: Math.max.apply(null, rows.map(r => r.machine_seconds)), definition: 'time the system itself took, from the form submission to the result, with the time spent waiting for a human to answer taken out' },
  latency_machine_seconds_groq_only: { median: med(groqRows.map(r => r.machine_seconds)), p95: pct(groqRows.map(r => r.machine_seconds), .95) }
};
// cost projections: ASSUMPTIONS, stated as such
const c = m.cost_usd_per_request.median || 0;
m.projection_assumptions = 'requests per day are assumptions for a pilot, not measurements';
m.projection = [10, 50, 500].map(n => ({ requests_per_day: n, usd_per_day: +(c * n).toFixed(4), usd_per_month_30d: +(c * n * 30).toFixed(3), tokens_per_day: Math.round((m.tokens_per_request.median_total || 0) * n) }));
fs.writeFileSync(path.join(__dirname, '..', 'data', 'round3_measurements.json'), JSON.stringify({ summary: m, runs: rows }, null, 2));
const f = (x, d) => x === null || x === undefined ? 'n/a' : (+x).toFixed(d === undefined ? 2 : d);
const md = ['# Round 3 measurements (from the audit log)', '', `Runs counted: ${m.runs_counted} (${JSON.stringify(m.runs_by_provider)}), since ${m.since}.`, '',
  `- Tokens per request: median ${m.tokens_per_request.median_in} in + ${m.tokens_per_request.median_out} out = ${m.tokens_per_request.median_total}; p95 ${m.tokens_per_request.p95_total}; max ${m.tokens_per_request.max_total}`,
  `- AI calls per request: median ${m.ai_calls_per_request.median}, max ${m.ai_calls_per_request.max}`,
  `- Cost per request (Groq, USD): median ${f(m.cost_usd_per_request.median, 6)}, p95 ${f(m.cost_usd_per_request.p95, 6)}, max ${f(m.cost_usd_per_request.max, 6)}`,
  `- Machine time per request: median ${f(m.latency_machine_seconds.median, 1)} s, p95 ${f(m.latency_machine_seconds.p95, 1)} s, max ${f(m.latency_machine_seconds.max, 1)} s (human wait removed); Groq-answered only: median ${f(m.latency_machine_seconds_groq_only.median, 1)} s`,
  '', '| requests/day (assumption) | USD/day | USD/month | tokens/day |', '|---|---|---|---|'].concat(m.projection.map(p => `| ${p.requests_per_day} | ${p.usd_per_day} | ${p.usd_per_month_30d} | ${p.tokens_per_day} |`));
fs.writeFileSync(path.join(__dirname, '..', 'data', 'round3_measurements.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
