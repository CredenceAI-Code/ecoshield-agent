// Shared page builders. Pasted into the Save memory, Build page and Dashboard Code nodes. Plain code, no network.
const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (v) => Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const n2 = (v) => Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FORM_URL = '__FORM_URL__';
const SCEN_LABEL = (s) => s.id + ' - ' + s.name;
const reqText = (r) => ({ MAIN_WATER_SHUTOFF: 'Close the main water valve', SETPOINT: 'Change the cooling setpoint to ' + r.setpoint_c + ' °C', COOLING_OFF: 'Switch cooling off', EXPORT_OCCUPANCY: 'Send room-by-room occupancy to a cloud AI', ROLLBACK: 'Roll back the last applied change (' + String(r.of || '').toLowerCase().replace(/_/g, ' ') + ')', RESET: 'Reset demo memory' }[r.type] || r.type);
const when = (iso) => { try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Dubai' }); } catch (e) { return String(iso); } };
function outcome(d) {
  const G = d.guard || {};
  if (d.special === 'RESET') return { tone: 'ok', head: 'Demo memory cleared: devices reopened, history and undo stack emptied' };
  if (d.gate === 'REJECT') return { tone: 'bad', head: G.rule === 'injection_blocked' ? 'Rejected before any AI saw it: prompt injection in the note' : 'Rejected: ' + String(G.rule || '').replace(/_/g, ' ') };
  const lcf = (t) => t.charAt(0).toLowerCase() + t.slice(1), nrp = (d.replans || []).length, rpTxt = nrp ? ' (replanned ' + nrp + ' of 2 allowed' + (d.request_original ? '; original: ' + lcf(reqText(d.request_original)) : '') + ')' : '';
  if (G.status === 'BLOCKED') {
    if (d.review && d.review.kind === 'replan_review') return { tone: 'bad', head: 'Blocked by a hard rule: ' + String(G.rule).replace(/_/g, ' ') + '. ' + nrp + ' replan' + (nrp === 1 ? '' : 's') + ' did not pass, so it went to ' + d.review.reviewer + ' for review: no change made' };
    return { tone: 'bad', head: 'Blocked by a hard rule: ' + String(G.rule).replace(/_/g, ' ') };
  }
  if (G.status === 'NO_CHANGE') return { tone: 'ok', head: (d.request_original ? 'Original request blocked; the safe alternative (' + lcf(reqText(d.request)) + ') already holds: nothing to change' : 'No change needed: already in that state, nobody asked again') };
  if (d.review && d.review.approved && d.write && d.write.ok) return { tone: 'ok', head: 'Approved by ' + d.review.reviewer + ' and ' + (d.request.type === 'ROLLBACK' ? 'rolled back' : 'applied') + ': ' + reqText(d.request) + rpTxt };
  if (d.review && d.review.approved && d.write && !d.write.ok) return { tone: 'bad', head: 'Approved, but the write gateway refused it: ' + d.write.error };
  return { tone: 'warn', head: 'Not approved: no change was made' + (d.review && d.review.note ? ' (' + d.review.note + ')' : '') + rpTxt };
}
const CSS = ':root{--bg:#f6f7f9;--card:#fff;--ink:#1b2430;--mut:#5d6b7c;--line:#dfe4ea;--ok:#13795b;--okb:#e3f5ee;--warn:#8a5a00;--warnb:#fff3d6;--bad:#b3261e;--badb:#fde8e6;--lnk:#1a5fb4}' +
  '@media(prefers-color-scheme:dark){:root{--bg:#10151c;--card:#18202a;--ink:#e8edf3;--mut:#9aa8b8;--line:#2a3544;--ok:#5fd3a8;--okb:#12352b;--warn:#f0c36a;--warnb:#3a2e12;--bad:#ff8f86;--badb:#3d1a18;--lnk:#8ab4f8}}' +
  'body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,Arial,sans-serif}.w{max-width:1000px;margin:0 auto;padding:20px 16px 48px}a{color:var(--lnk)}' +
  'h1{font-size:22px;margin:0 0 2px}h2{font-size:14px;margin:0 0 10px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}.sub{color:var(--mut);margin:0 0 16px}' +
  '.banner{padding:14px 16px;border-radius:10px;font-weight:600;margin:12px 0 16px}.banner.ok{background:var(--okb);color:var(--ok)}.banner.warn{background:var(--warnb);color:var(--warn)}.banner.bad{background:var(--badb);color:var(--bad)}' +
  '.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:760px){.grid{grid-template-columns:1fr}}' +
  '.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}.full{grid-column:1/-1}' +
  '.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700}.pill.ok{background:var(--okb);color:var(--ok)}.pill.warn{background:var(--warnb);color:var(--warn)}.pill.bad{background:var(--badb);color:var(--bad)}' +
  'table{width:100%;border-collapse:collapse;font-size:13.5px}td,th{padding:5px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--mut);font-weight:600}.r{text-align:right}.mono{font-family:Consolas,monospace}.sm{font-size:11.5px;color:var(--mut);word-break:break-all}' +
  'pre{background:var(--bg);border:1px solid var(--line);padding:10px;border-radius:8px;overflow:auto;font-size:12px;margin:8px 0 0}.mut{color:var(--mut)}.big{font-size:26px;font-weight:700}' +
  'details.dt{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:10px}details.dt>summary{cursor:pointer;font-weight:600;font-size:14px}details.dt[open]>summary{margin-bottom:10px}.gl td{padding:7px 6px}.gl td:first-child{width:150px;color:var(--mut);font-weight:600}.stack{margin-top:6px}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tag{font-size:12px;color:var(--mut)}.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}@media(max-width:760px){.tiles{grid-template-columns:1fr 1fr}}.tile b{display:block;font-size:24px}';
const shell = (title, inner) => '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body><div class="w">' + inner + '</div></body></html>';
const card = (t, body, full) => '<div class="card' + (full ? ' full' : '') + '"><h2>' + t + '</h2>' + body + '</div>';
const det = (t, body) => '<details class="dt"><summary>' + t + '</summary>' + body + '</details>';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const lim = (k, d) => (typeof LIMITS !== 'undefined' && LIMITS[k] !== undefined) ? LIMITS[k] : d;
const PLAIN = { occupied_over_limit: () => 'people are inside and the requested temperature is above the ' + lim('OCCUPIED_MAX_C', 24) + ' °C safety limit', unoccupied_over_precool_ceiling: () => 'the building is empty but the requested pre-cooling temperature is above the ' + lim('UNOCCUPIED_PRECOOL_MAX_C', 27) + ' °C ceiling', cooling_off_in_heat: () => 'cooling cannot be switched off while people are inside in this heat', privacy_export_blocked: () => 'occupancy data must never leave the device', untrusted_data: () => 'the meter data failed its checks, so nothing can be judged safe', injection_blocked: () => 'the note tried to give the system orders, and notes are treated as data only', nothing_to_roll_back: () => 'there is nothing to undo' };
const plainRule = (r) => PLAIN[r] ? PLAIN[r]() : String(r || '').replace(/_/g, ' ');
const pill = (t, k) => '<span class="pill ' + k + '">' + esc(t) + '</span>';
const devText = (dv) => dv ? 'Main valve <b>' + esc(dv.main_valve) + '</b> &middot; setpoint <b>' + esc(dv.setpoint_c) + ' °C</b> &middot; cooling <b>' + esc(dv.cooling) + '</b> &middot; open alerts <b>' + (dv.alerts || []).filter(a => a.open).length + '</b>' : '';

// Short plain-language summary shown first; the detailed stage cards below it are collapsed.
function glance(d) {
  const G = d.guard || {}, L = d.leak, B = d.bill, rv = d.review, req = d.request_original || d.request || {}, rows = [];
  const row = (k, v) => rows.push('<tr><td>' + k + '</td><td>' + v + '</td></tr>');
  row('Asked', esc(reqText(req)));
  let dec;
  if (d.gate === 'REJECT') dec = '<b>Stopped at the door:</b> ' + esc(plainRule(G.rule)) + '. Nothing ran.';
  else if (G.status === 'BLOCKED') dec = '<b>Blocked by code:</b> ' + esc(plainRule(G.rule)) + '. Nothing was changed.' + ((d.replans || []).length ? ' The AI tried ' + d.replans.length + ' safer setpoint' + (d.replans.length === 1 ? '' : 's') + '; none passed the same check, so a person reviewed it.' : '');
  else if (G.status === 'NO_CHANGE') dec = '<b>No change needed:</b> that state already holds.';
  else if (G.status === 'AUTO') dec = '<b>Low risk:</b> done automatically.';
  else dec = '<b>Allowed:</b> inside every safety limit.' + (d.request_original ? ' (A safer setpoint proposed by the AI passed the same check.)' : '') + ' A person must still approve it.';
  row('Code decided', dec);
  if (d.evidence) row('Evidence strength', '<b>' + d.evidence.score + ' / 100 &middot; code ' + esc(d.evidence.level) + (d.ev_ai ? ' &middot; AI ' + esc(d.ev_ai.level) : '') + (d.autonomy ? ' &rarr; ' + esc(d.autonomy.level) : '') + '</b>' + (d.autonomy ? '. ' + esc(d.autonomy.text) : ''));
  if (d.auto && d.auto.status === 'DONE') row(d.auto.approved_by ? 'Alert' : 'Done automatically', d.auto.approved_by ? 'Leak alert raised after ' + esc(d.auto.approved_by) + ' approved it (logged, can be undone).' : 'Leak alert raised (logged, can be undone).');
  else if (d.auto && d.auto.status === 'HELD') row('Alert', 'Held: it waits for a named person to approve it.');
  else if (d.auto && d.auto.status === 'WATCH_ONLY') row('Alert', 'Not raised: the evidence is too weak, so it is logged and watched.');
  let who;
  if (rv && rv.kind === 'replan_review') who = esc(rv.reviewer) + ' reviewed it after the AI\'s tries ran out: ' + esc(rv.decision) + '. No change was possible.';
  else if (rv) who = rv.approved ? '<b>Approved</b> by ' + esc(rv.reviewer) + '.' : '<b>Not approved</b> (' + esc(rv.reviewer) + ').';
  else who = '<span class="mut">Not asked: ' + (G.status === 'BLOCKED' || d.gate === 'REJECT' ? 'a rule stopped it first.' : 'nothing to approve.') + '</span>';
  row('Person', who);
  if (d.write) row('Written', d.write.ok ? 'Applied through the single write gateway (snapshot kept, can be undone).' : 'Refused and rolled back: ' + esc(d.write.error));
  if (L) row('Leak check', L.verdict === 'LEAK' ? '<b>LEAK:</b> about ' + L.est_lph + ' L/h (about ' + n0(L.est_litres_per_day) + ' litres a day) while nobody was there.' : '<b>' + esc(L.verdict.replace('_', ' ')) + ':</b> ' + esc(L.reason));
  if (B) row('Bill forecast', '<b>AED ' + n2(B.with_leak.total_aed) + '</b> this month' + (B.without_leak ? '; the leak adds about <b>AED ' + n2(B.leak_bill_impact_aed) + '</b>' : '') + (B.tariff_verified ? '' : ' <span class="mut">(tariff assumed, not verified)</span>'));
  row('Privacy', '<b>Occupancy sent to a cloud AI: NO.</b>' + ((d.egress_log || []).length ? ' Only sanitised totals and decisions went out.' : ' No AI call was made.'));
  row('The AI\'s part', d.ai ? (d.ai.from_ai ? 'Chose the tool order and wrote the explanation below. It decided nothing.' : 'Not used this time; plain-code wording is shown below.') : 'Not used (nothing was analysed).');
  return card('In plain words', '<table class="gl">' + rows.join('') + '</table>', true);
}

function renderPage(d, opt) {
  opt = opt || {};
  const oc = outcome(d), L = d.leak, B = d.bill, G = d.guard || {}, req = d.request || {};
  if (d.special === 'RESET') return shell('EcoShield', '<h1>EcoShield &middot; memory reset</h1><div class="banner ok">' + esc(oc.head) + '</div><p><a href="' + FORM_URL + '">Back to the console</a> &middot; <a href="/webhook/ecoshield-dashboard">Dashboard</a></p>');
  let h = '<h1>EcoShield &middot; Scenario ' + d.scenario.id + ': ' + esc(d.scenario.name) + '</h1><p class="sub">' + esc(d.scenario.desc) + ' &nbsp;|&nbsp; run ' + esc(d.run_id) + ' &nbsp;|&nbsp; SYNTHETIC data &nbsp;|&nbsp; tariff ' + (B ? (B.tariff_verified ? 'DEWA published rates (simplified)' : 'ASSUMED, not verified') : 'n/a') + ' &nbsp;|&nbsp; <a href="/webhook/ecoshield-dashboard">Dashboard</a> &middot; <a href="' + FORM_URL + '">Console</a></p>';
  if (opt.replay) h += '<div class="banner warn">Replayed from the log (recorded ' + esc(when(opt.at)) + '). Nothing was re-run: no tools, no AI, no writes.</div>';
  const ai = d.ai;
  const aiCard = card('Explanation (the AI wrote the words; it decided nothing)', ai ? '<p class="tag">' + (ai.from_ai ? 'Written by ' + (ai.provider === 'groq' ? 'Groq gpt-oss-120b (cloud, sanitized data only)' : (ai.provider === 'groq-20b' ? 'Groq gpt-oss-20b (cloud fallback, sanitized data only)' : 'Ollama qwen3:1.7b (local fallback)')) + (ai.tokens ? ' &middot; ' + ai.tokens + ' tokens' : '') : 'No AI text used (' + esc(ai.note) + '). Plain-code template shown instead.') + '</p><p><b>' + esc(ai.text.headline) + '</b></p><p>' + esc(ai.text.explanation) + '</p><p class="mut">Next step: ' + esc(ai.text.tip) + '</p>' : '<p class="mut">No AI explanation: nothing was analysed.</p>', true);
  h += '<div class="banner ' + oc.tone + '">' + esc(oc.head) + '</div><div class="stack">' + glance(d) + '</div><div class="stack">' + aiCard + '</div><p class="tag" style="margin:14px 0 8px">Details for judges: click a line to open it. The audit trail at the bottom lists every step.</p><div class="stack">';
  // 1 validation
  let v = '';
  if (d.note) { const rej = d.gate === 'REJECT' && G.rule === 'injection_blocked'; v += '<p>Operator note: <i>&ldquo;' + esc(String(d.note).slice(0, 300)) + '&rdquo;</i></p><p>' + pill(rej ? 'REJECTED' : 'ACCEPTED as data', rej ? 'bad' : 'ok') + ' ' + (rej ? esc(G.reason) : 'It is logged but never treated as an instruction and never sent to an AI.') + '</p>'; }
  else v += '<p class="mut">No operator note attached.</p>';
  if (d.rooms) { v += '<p><b>Room setpoints</b> (request: raise empty rooms to ' + d.roomReq.target + ' C' + (d.roomReq.offline.length ? '; sensor offline: ' + d.roomReq.offline.join(', ') : '') + ')</p><ul>'; d.rooms.forEach(function (r) { v += '<li><b>' + r.room + '</b>: ' + r.status + (r.setpoint_c !== null ? ' at ' + r.setpoint_c + ' C' : '') + '. ' + r.reason + '</li>'; }); v += '</ul>'; }
  if (d.data) v += '<p>Meter feed: ' + pill(d.data.ok ? 'PASSED' : 'REJECTED', d.data.ok ? 'ok' : 'bad') + ' ' + d.data.rows + ' readings &middot; ' + (d.data.bad_values || 0) + ' impossible &middot; newest ' + d.data.newest_age_hours + ' h old</p>' + (d.data.issues && d.data.issues.length ? '<ul>' + d.data.issues.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '');
  else v += '<p class="mut">Meter feed: not read (the input was rejected first).</p>';
  h += det('1 &middot; Input checks: the note and the meter data', v);
  // 2 planner
  const pl = d.plan_log || [];
  h += det('2 &middot; Planner loop: the AI picks the tool order, code enforces it', pl.length ? '<table><tr><th>#</th><th>Allowed now</th><th>Chosen</th><th>By</th></tr>' + pl.map(p => '<tr><td>' + p.step + '</td><td class="sm">' + esc(p.runnable.join(', ')) + '</td><td class="mono">' + esc(p.choice) + '</td><td class="sm">' + esc(p.by) + (p.why ? ' &middot; &ldquo;' + esc(p.why) + '&rdquo;' : '') + '</td></tr>').join('') + '</table><p class="tag">Steps ' + (d.steps || 0) + ' of 8 allowed &middot; invalid AI picks ' + (d.invalid || 0) + ' of 2 allowed &middot; planner mode ' + esc(d.planner_mode) + '. The AI orders the tools; code decides what is allowed and when to stop.</p>' : '<p class="mut">Not reached.</p>');
  // 3 leak
  if (L) { const vk = { LEAK: 'bad', WATCH: 'warn', NO_LEAK: 'ok', INSUFFICIENT_DATA: 'warn' }[L.verdict] || 'warn';
    h += det('3 &middot; Leak check', '<div class="big">' + pill(L.verdict, vk) + '</div><p>' + esc(L.reason) + '</p>' + (L.verdict === 'LEAK' ? '<p><b>' + L.est_lph + ' L/h</b> &asymp; <b>' + n0(L.est_litres_per_day) + ' L/day</b>. First seen day ' + L.first_seen.day + ', ' + String(L.first_seen.hour).padStart(2, '0') + ':00.</p>' : '') +
      '<table><tr><th>Night (01:00–05:00, unoccupied)</th><th class="r">Lowest flow</th><th class="r"></th></tr>' + (L.nights || []).slice(-7).map(n => '<tr><td>Day ' + n.day + '</td><td class="r">' + n.min + ' L/h</td><td class="r">' + (n.min >= 10 ? 'flagged' : '') + '</td></tr>').join('') + '</table>'); }
  else h += det('3 &middot; Leak check', '<p class="mut">Not run' + (d.data && !d.data.ok ? ': the feed failed validation, so no verdict is honest.' : '.') + '</p>');
  // 3b evidence strength -> autonomy level (all code)
  if (d.evidence) { const E = d.evidence, A = d.autonomy || {}, ek = { HIGH: 'ok', MEDIUM: 'warn', LOW: 'bad' }[E.level] || 'warn';
    h += det('3b &middot; Evidence strength and autonomy level (code decides how much the agent may do alone)', '<div class="big">' + E.score + ' / 100 ' + pill(E.level, ek) + '</div>' +
      (E.reasons.length ? '<table><tr><th>What weakened the evidence</th><th class="r">Points lost</th></tr>' + E.reasons.map(r => '<tr><td>' + esc(r.why) + '</td><td class="r">&minus;' + r.points + '</td></tr>').join('') + '</table>' : '<p>Nothing weakened it: full night coverage, no impossible readings, fresh feed, clear signal.</p>') +
      '<table style="margin-top:8px"><tr><th>Score</th><th>Autonomy</th><th>What the agent may do alone</th></tr><tr><td>85 and up</td><td>HIGH</td><td>raise the leak alert automatically</td></tr><tr><td>50 to 84</td><td>MEDIUM</td><td>hold the alert until a named person approves</td></tr><tr><td>under 50</td><td>LOW</td><td>raise nothing; log as insufficient evidence and watch</td></tr></table>' +
      '<p class="tag">' + esc(A.text || '') + '</p>' + (d.ev_ai ? '<table style="margin-top:8px"><tr><th>Code says</th><th>AI second opinion</th><th>Final (who acts)</th></tr><tr><td>' + esc(A.code_level || E.level) + ' (' + E.score + ' / 100)</td><td>' + esc(d.ev_ai.level) + (d.ev_ai.confidence ? ' (' + d.ev_ai.confidence + '% sure)' : '') + ': ' + esc(d.ev_ai.reason) + '</td><td><b>' + esc(A.level || '') + '</b>: ' + esc(A.source || '') + '</td></tr></table><p class="tag">The rule: the agent acts alone only if code AND AI both say HIGH. If either says MEDIUM or higher, a named person reviews. The AI sees plain facts, not the score; it can hold an action back or ask for a review, but never make the agent act alone.</p>' : '<p class="tag">No AI second opinion was available for this run, so the code level was used alone.</p>')); }
  // 4 bill
  if (B) { const W = B.with_leak.water, E = B.with_leak.electricity;
    const slabRows = (steps, unit) => steps.map(s => '<tr><td>' + n0(s.from) + (s.to ? ' – ' + n0(s.to) : '+') + '</td><td class="r">' + n0(s.units) + ' ' + unit + '</td><td class="r">' + s.rate + '</td><td class="r">' + n2(s.cost) + '</td></tr>').join('');
    h += det('4 &middot; Bill forecast, slab by slab', '<div class="big">AED ' + n2(B.with_leak.total_aed) + '</div><p class="mut">' + esc(B.method) + '</p>' +
      '<table><tr><th>Electricity slab (kWh)</th><th class="r">Units</th><th class="r">AED/kWh</th><th class="r">AED</th></tr>' + slabRows(E.steps, 'kWh') + '<tr><td colspan="3">Fuel surcharge</td><td class="r">' + n2(E.fuel_surcharge) + '</td></tr></table>' +
      '<table style="margin-top:8px"><tr><th>Water slab (m&sup3;)</th><th class="r">Units</th><th class="r">AED/m&sup3;</th><th class="r">AED</th></tr>' + slabRows(W.steps, 'm&sup3;') + '<tr><td colspan="3">Fuel surcharge</td><td class="r">' + n2(W.fuel_surcharge) + '</td></tr></table>' + '<p class="mut">Subtotal AED ' + n2(B.with_leak.subtotal_aed) + ' + 5% VAT AED ' + n2(B.with_leak.vat_aed) + '</p>' +
      (B.without_leak ? '<p>Without the leak: AED ' + n2(B.without_leak.total_aed) + '. <b>The leak adds about AED ' + n2(B.leak_bill_impact_aed) + '.</b></p>' : '')); }
  else h += det('4 &middot; Bill forecast', '<p class="mut">Not run.</p>');
  // 5 privacy
  const eg = d.egress_log || [];
  h += det('5 &middot; Privacy: what left the laptop', '<p><b>Occupancy sent to any cloud AI: NO.</b> ' + (eg.length ? 'Raw meter and occupancy rows never left this laptop.' : 'No AI call was made at all.') + '</p>' + (eg.length ? '<table><tr><th>Call</th><th>To</th><th class="r">Fields</th><th class="r">Bytes</th></tr>' + eg.map(e => '<tr><td>' + esc(e.purpose) + '</td><td class="sm">' + esc(e.destination) + '</td><td class="r">' + e.sent_fields.length + '</td><td class="r">' + e.bytes + '</td></tr>').join('') + '</table><p class="tag">Allow-list, not block-list. Last payload the AI was sent:</p>' : '') + (d.outbound ? '<pre>' + esc(JSON.stringify(d.outbound, null, 1)) + '</pre>' : ''));
  // 6 guard
  const gk = { BLOCKED: 'bad', NEEDS_APPROVAL: 'warn', NO_CHANGE: 'ok', AUTO: 'ok', OK: 'ok' }[G.status] || 'warn';
  let g = '<p>Request: <b>' + esc(reqText(req)) + '</b></p><p>' + pill(String(G.status).replace('_', ' '), gk) + ' &nbsp;rule <span class="mono">' + esc(G.rule) + '</span></p><p>' + esc(G.reason) + '</p>' + (G.suggested_setpoint_c ? '<p>Highest allowed here: <b>' + G.suggested_setpoint_c + ' °C</b>.</p>' : '');
  if (d.auto) g += d.auto.status === 'DONE' ? '<p>Automatic action: ' + pill('AUTO', 'ok') + ' leak alert <span class="mono">' + esc(d.auto.alert.id) + '</span> raised through the write gateway. Logged and reversible (Undo).</p>' : '<p>Automatic action: ' + esc(d.auto.text || d.auto.error) + '</p>';
  else g += '<p class="mut">Automatic action: none needed.</p>';
  g += d.review ? (d.review.kind === 'replan_review' ? '<p>Human review after the replan cap: <b>' + esc(d.review.decision) + '</b> by ' + esc(d.review.reviewer) + '. The guard stays in force: no write was possible.' + (d.review.comment ? ' Note: &ldquo;' + esc(d.review.comment) + '&rdquo;' : '') + '</p>' : '<p>Human decision: <b>' + (d.review.approved ? 'Approved' : 'Not approved') + '</b> by ' + esc(d.review.reviewer) + '.' + (d.review.comment ? ' Note: &ldquo;' + esc(d.review.comment) + '&rdquo;' : '') + '</p>') : '<p class="mut">No human was asked' + (G.status === 'NO_CHANGE' ? ': nothing to change.' : ': a rule stopped it first.') + '</p>';
  g += d.write ? '<p>Write gateway: ' + (d.write.ok ? 'applied (re-checked, snapshot kept).' : 'refused and rolled back (' + esc(d.write.error) + ')') + '</p>' : '<p class="mut">Write gateway: nothing written for the request.</p>';
  h += det('6 &middot; Safety check, approval and write', g);
  // 6b replan loop
  if ((d.replans || []).length) {
    const rk = { passed: 'ok', no_effect: 'ok', rejected: 'bad', unreadable: 'warn', gave_up: 'warn', no_ai: 'warn' }, GO = d.guard_original || {};
    h += det('6b &middot; Replan loop: a rejected plan goes back to the AI, max 2 tries, then a person', '<p>First plan <b>' + esc(reqText(d.request_original || req)) + '</b> was ' + pill(GO.status || 'BLOCKED', 'bad') + ' by rule <span class="mono">' + esc(GO.rule) + '</span>. ' + esc(GO.reason) + '</p>' +
      '<table><tr><th>Replan</th><th>By</th><th class="r">Proposed</th><th>Guard (code)</th><th>Result</th></tr>' + d.replans.map(a => '<tr><td>' + a.n + ' of 2</td><td class="sm">' + esc(a.provider || 'none') + '</td><td class="r">' + (a.proposal_c === null ? '–' : a.proposal_c + ' °C') + '</td><td class="sm">' + esc(a.rule || a.note || '') + '</td><td>' + pill(String(a.result).replace('_', ' '), rk[a.result] || 'warn') + '</td></tr>').join('') + '</table>' +
      '<p class="tag">The AI proposes; only the guard decides. ' + ({ accepted: 'A proposal passed the guard, so it went on to human approval.', no_change: 'A proposal passed the guard but changes nothing.', review: 'The cap was reached (or the AI gave up or was unavailable), so replanning stopped and a person was asked, with these reasons.' }[d.rp_done] || '') + ' Hard blocks (privacy, injection, untrusted data) are never replanned.</p>', true);
  }
  // 7 memory
  const hi = d.history_info, fin = d.write && d.write.ok ? d.write.device : d.device;
  h += det('7 &middot; Memory, kept between runs', (hi ? '<p>Earlier runs of this scenario: <b>' + hi.prior_runs + '</b> &middot; open alert before this run: <b>' + (hi.open_alert ? 'yes' : 'no') + '</b></p><p>Earlier decision on this request: ' + (hi.last_decision ? '<b>' + (hi.last_decision.approved ? 'approved' : 'rejected') + '</b> by ' + esc(hi.last_decision.reviewer) : 'none') + '</p>' : '<p class="mut">History was not consulted in this run.</p>') + (fin ? '<p>Building state after this run: ' + devText(fin) + '</p>' : '') + '<p class="tag">Kept between runs and restarts. Undo and Reset are on the dashboard.</p>');
  h += det('How the work was split (code / AI / human)', '<div class="two"><div><b>Code decided</b><br>input validation &middot; leak verdict &middot; every slab and total &middot; what may leave the device &middot; whether the request is allowed &middot; which tools may run and when to stop &middot; the final write</div><div><b>AI did</b><br>chose the tool order (inside an allow-list) and wrote the explanation above from numbers it was handed. A wrong pick is overridden; an invented number discards its text.</div></div>', true);
  h += det('Audit trail: ' + d.trace.length + ' events' + (opt.replay ? ', as recorded' : ', also saved to ecoshield_audit.jsonl'), '<table><tr><th>Time</th><th>Who</th><th>Step</th><th>Detail</th></tr>' + d.trace.map(t => '<tr><td class="mono">' + esc(String(t.ts).slice(11, 19)) + '</td><td>' + esc(t.actor) + '</td><td>' + esc(t.step) + '</td><td class="mono sm">' + esc(JSON.stringify(t.detail)) + '</td></tr>').join('') + '</table>', true);
  return shell('EcoShield result', h + '</div>');
}

function renderDashboard(mem) {
  const hist = mem.history || [], last = {};
  hist.forEach(x => { last[x.scenario_id] = x; });
  const approved = hist.filter(x => x.d.review && x.d.review.approved).length, blocked = hist.filter(x => x.tone === 'bad').length;
  const openAlerts = Object.values(mem.devices || {}).reduce((a, dv) => a + (dv.alerts || []).filter(al => al.open).length, 0);
  let h = '<h1>EcoShield &middot; dashboard</h1><p class="sub">Synthetic data &middot; DEWA published tariff (simplified) &middot; state is kept between runs and restarts &middot; <a href="/webhook/ecoshield-dashboard">refresh</a></p>';
  h += '<div class="tiles"><div class="card tile"><b>' + (mem.runs || 0) + '</b>runs logged</div><div class="card tile"><b>' + approved + '</b>approved by a person</div><div class="card tile"><b>' + blocked + '</b>blocked or rejected</div><div class="card tile"><b>' + openAlerts + '</b>open leak alerts</div></div>';
  h += '<p><a href="' + FORM_URL + '">Open the console</a> &middot; <a href="' + FORM_URL + '?Scenario=' + encodeURIComponent('UNDO - roll back the last applied change') + '">Undo the last change</a> (' + (mem.undo || []).length + ' on the undo stack) &middot; <a href="' + FORM_URL + '?Scenario=' + encodeURIComponent('RESET - clear the demo memory') + '">Reset demo memory</a></p>';
  h += '<div class="grid">';
  ALL_SCENARIOS.forEach(s => { const x = last[s.id], dv = (mem.devices || {})[s.id];
    h += card('Scenario ' + s.id, '<b>' + esc(s.name) + '</b><p class="mut">' + esc(s.desc) + '</p>' + (x ? '<p>' + pill(x.tone === 'ok' ? 'OK' : (x.tone === 'bad' ? 'BLOCKED' : 'NOT APPROVED'), x.tone) + ' ' + esc(x.head) + '</p><p class="tag">' + esc(when(x.at)) + ' &middot; <a href="?run=' + encodeURIComponent(x.run_id) + '">replay from the log</a></p>' : '<p class="mut">Not run yet.</p>') + (dv ? '<p class="tag">' + devText(dv) + '</p>' : '') + '<p><a href="' + FORM_URL + '?Scenario=' + encodeURIComponent(SCEN_LABEL(s)) + '">Run this scenario</a></p>'); });
  h += '</div><div class="card" style="margin-top:14px"><h2>Recent cases (newest first)</h2><table><tr><th>Time</th><th>Scenario</th><th>Outcome</th><th>Replay</th></tr>' + hist.slice().reverse().slice(0, 25).map(x => '<tr><td class="sm">' + esc(when(x.at)) + '</td><td>' + x.scenario_id + ' ' + esc(x.scenario_name) + '</td><td>' + esc(x.head) + '</td><td><a href="?run=' + encodeURIComponent(x.run_id) + '">replay</a></td></tr>').join('') + '</table></div>';
  return shell('EcoShield dashboard', h);
}
