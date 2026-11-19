"""Builds ecoshield_workflow.json (v2) for LOCAL n8n (self-hosted, so occupancy data never leaves the laptop).
Plain-code logic = core.js, page builders = page_js.js, both pasted verbatim into Code nodes (tests run the same files in Node).
Run: python make_ecoshield_workflow.py
Credentials: "Groq key" (HTTP Bearer) only. Ollama needs none (localhost).
Node ids and webhook ids are deterministic, so re-importing never changes the form URL.
"""
import json
import os
import re
import subprocess
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
OLLAMA_ONLY = os.environ.get("ECO_OLLAMA_ONLY") == "1"   # test build: Groq URL points at a dead port, so every AI call must run on local Ollama
OUT = os.path.join(HERE, "tests", "ollama_only_workflow.json") if OLLAMA_ONLY else os.path.join(HERE, "ecoshield_workflow.json")
WORKFLOW_ID = "va1J6ZZ2bCfcd2mT"          # existing local workflow: importing with this id overwrites it
CONSOLE_FORM_ID = "be2bf8f1-b886-4585-950c-82bcc0648882"   # keep the already-published form URL
GROQ = {"id": "cp345zTDAw124tjT", "name": "Groq key"}
GROQ_URL = "http://127.0.0.1:9/groq-switched-off" if os.environ.get("ECO_OLLAMA_ONLY") == "1" else "https://api.groq.com/openai/v1/chat/completions"
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"   # 127.0.0.1, not localhost: Node may try IPv6 ::1 first, where Ollama is not listening
AUDIT_FILE = os.path.join(os.path.expanduser("~"), ".n8n-files", "ecoshield_audit.jsonl").replace("\\", "/")
NS = uuid.UUID("6f1c2f0e-0000-4000-8000-ec05a1e1d000")


def uid(name):
    return str(uuid.uuid5(NS, name))


CORE = open(os.path.join(HERE, "core.js"), encoding="utf-8").read()
CORE = re.sub(r"\nif \(typeof module.*$", "\n", CORE, flags=re.S)  # n8n sandbox: no module.exports
PAGE = open(os.path.join(HERE, "page_js.js"), encoding="utf-8").read().replace("__FORM_URL__", "http://localhost:5678/form/" + CONSOLE_FORM_ID)

SCENARIO_LABELS = json.loads(subprocess.check_output(
    ["node", "-e", "const C=require('./core.js');console.log(JSON.stringify(C.ALL_SCENARIOS.map(s=>s.id+' - '+s.name)))"], cwd=HERE).decode())
SCENARIO_LABELS += ["UNDO - roll back the last applied change", "RESET - clear the demo memory"]

nodes, conns = [], {}


def add(name, type_, params, x, y, version=2, **extra):
    node = {"id": uid("node:" + name), "name": name, "type": type_, "typeVersion": version,
            "position": [x, y], "parameters": params}
    node.update(extra)
    nodes.append(node)
    return name


def code(name, js, x, y):
    return add(name, "n8n-nodes-base.code", {"jsCode": js.strip()}, x, y, version=2)


def link(a, b, out=0):
    conns.setdefault(a, {"main": []})
    while len(conns[a]["main"]) <= out:
        conns[a]["main"].append([])
    conns[a]["main"][out].append({"node": b, "type": "main", "index": 0})


def if_true(name, expr, x, y):
    return add(name, "n8n-nodes-base.if", {"conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
        "conditions": [{"id": uid("cond:" + name), "leftValue": expr, "rightValue": "",
                        "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
        "combinator": "and"}, "options": {}}, x, y, version=2.2)


def groq_http(name, body_expr, timeout, retries, x, y):
    extra = {"retryOnFail": True, "maxTries": 2, "waitBetweenTries": 1000} if retries else {}
    return add(name, "n8n-nodes-base.httpRequest", {
        "method": "POST", "url": GROQ_URL, "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify(" + body_expr + ") }}", "options": {"timeout": timeout}},
        x, y, version=4.2, onError="continueErrorOutput", credentials={"httpBearerAuth": GROQ}, **extra)


def ollama_http(name, body_expr, timeout, x, y):
    return add(name, "n8n-nodes-base.httpRequest", {
        "method": "POST", "url": OLLAMA_URL, "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify(" + body_expr + ") }}", "options": {"timeout": timeout}},
        x, y, version=4.2, onError="continueErrorOutput")


# ------------------------------------------------------------------ JS pieces
EV = r"""
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
"""

JS_VALIDATE = CORE + r"""
// ===== Stage 1-2: trigger arrives, validate and sanitise BEFORE any tool or model =====
const sd = $getWorkflowStaticData('global'); sd.mem = sd.mem || newMemory(); const mem = sd.mem;
const sel = String($json['Scenario'] || '').trim();
const noteIn = String($json['Operator note'] || '');
const st = { run_id: 'ES-' + Date.now().toString(36).toUpperCase(), trace: [], steps: 0, done: [], plan_log: [], egress_log: [], invalid: 0, llm_failures: 0, planner_mode: 'llm', note: '' };
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
ev('human', 'input', { selection: sel, note_attached: !!noteIn.trim() });
const reject = (scenario, request, guard, extra) => [{ json: Object.assign(st, { gate: 'REJECT', scenario, request, guard, leak: null, bill: null, data: null, ai: null }, extra || {}) }];
if (/^RESET/i.test(sel)) {
  sd.mem = newMemory(); ev('tool', 'reset_demo_memory', { devices: 0, history: 0, undo: 0 });
  return reject({ id: 0, name: 'Reset demo memory', desc: '' }, { type: 'RESET' }, { status: 'OK', rule: 'reset', reason: 'Demo memory cleared.' }, { special: 'RESET' });
}
let scn, request;
if (/^UNDO/i.test(sel)) {
  const u = mem.undo[mem.undo.length - 1];
  if (!u) { ev('guard', 'rollback_lookup', { found: false }); return reject({ id: 0, name: 'Undo the last change', desc: '' }, { type: 'ROLLBACK' }, { status: 'BLOCKED', rule: 'nothing_to_roll_back', reason: 'There is no earlier change to undo.', suggested_setpoint_c: null }); }
  scn = ALL_SCENARIOS.find(s => s.id === u.scenario_id); request = { type: 'ROLLBACK', restore: u.restore, undo_run: u.uid, of: u.action };
  ev('memory', 'rollback_lookup', { found: true, of_run: u.run_id, action: u.action });
} else {
  scn = ALL_SCENARIOS.find(s => s.id === parseInt(sel, 10)); if (!scn) throw new Error('Unknown scenario: ' + sel); request = scn.request;
}
const note = noteIn.trim() || scn.note || '';
const nv = validateNote(note);
ev('guard', 'input_validation', { note_checked: !!note, ok: nv.ok, reason: nv.reason || null, note: note.slice(0, 400) });
Object.assign(st, { scenario: { id: scn.id, name: scn.name, desc: scn.desc }, request, note });
if (!nv.ok) return reject(st.scenario, request, { status: 'BLOCKED', rule: nv.rule, reason: nv.reason, suggested_setpoint_c: null });
const dev = mem.devices[scn.id];
st.device = dev ? JSON.parse(JSON.stringify(dev)) : defaultDevice();
ev('memory', 'load_device_state', { device: st.device, prior_runs: lookupHistory(mem, scn.id, request.type).prior_runs });
st.gate = 'RUN';
return [{ json: st }];
"""

JS_PLAN_STATE = CORE + r"""
// ===== Stage 3: plan. The LLM only ORDERS the tools; code decides what is allowed =====
const st = Object.assign({}, $json); st.trace = st.trace.slice();
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
const run = runnable(st), det = deterministicNext(st);
let need = false, by = '';
if (st.steps >= MAX_STEPS) by = 'step cap reached: fixed order';
else if (st.planner_mode === 'deterministic') by = 'planner already switched to the fixed order';
else if (run.length === 1) by = 'only one tool was allowed, no AI call needed';
else need = true;
st.runnableNow = run; st.det = det; st.need_llm = need; st.by_no_llm = by;
if (need) {
  const s = sanitize(planView(st), 'groq (planner)');
  const user = JSON.stringify(s.payload);
  if (/occup|presence|room|people|schedule|empty/i.test(user)) throw new Error('Egress check failed in planner prompt');
  st.egress_log = st.egress_log.concat([Object.assign({ purpose: 'plan step ' + (st.steps + 1) }, s.egress)]);
  const system = 'You are the planner inside EcoShield, a water and cooling saving agent for a school. Pick the NEXT tool to run, from the "runnable" list ONLY. ' +
    'Tools: read_meter_data (load and check the feed); run_leak_and_bill_forecaster (leak verdict and slab bill); lookup_case_history (earlier decisions and open alerts; worth doing before a valve or setpoint request); ' +
    'check_safety_guard (judge the request against the hard limits); finish (only when the forecast and the guard check are done). You decide ORDER only. You cannot approve, block or change anything. ' +
    'Reply with JSON only: {"next":"<one runnable tool>","why":"<=10 words"}.';
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  st.planBodies = { groq: { model: 'openai/gpt-oss-120b', temperature: 0, max_tokens: 120, reasoning_effort: 'low', messages }, groq20: { model: 'openai/gpt-oss-20b', temperature: 0, max_tokens: 120, reasoning_effort: 'low', messages }, ollama: { model: 'qwen3:1.7b', stream: false, think: false, options: { temperature: 0, num_predict: 60 }, messages } };
}
return [{ json: st }];
"""

JS_PARSE_PLAN = CORE + r"""
const p = $('Plan state').first().json, j = $json || {};
const st = Object.assign({}, p); ['planBodies', 'runnableNow', 'det', 'need_llm', 'by_no_llm'].forEach(k => delete st[k]);
st.trace = p.trace.slice();
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
let choice = p.det, by = '', why = '', provider = null;
if (!p.need_llm) by = p.by_no_llm;
else {
  let raw = '';
  if (j.choices && j.choices[0] && j.choices[0].message) { provider = /gpt-oss-20b/i.test(String(j.model || '')) ? 'groq-20b' : 'groq'; raw = String(j.choices[0].message.content || ''); }
  else if (j.message && j.message.content) { provider = 'ollama'; raw = String(j.message.content); }
  if (!provider) { st.planner_mode = 'deterministic'; st.llm_failures = (st.llm_failures || 0) + 1; by = 'fixed order (no AI planner answered)'; }
  else {
    let next = null;
    try { const m = raw.replace(/<think>[\s\S]*?<\/think>/g, '').match(/\{[\s\S]*\}/); const o = JSON.parse(m[0]); next = String(o.next || '').trim(); why = String(o.why || '').slice(0, 80); } catch (e) {}
    if (next && p.runnableNow.indexOf(next) >= 0) { choice = next; by = 'AI planner (' + provider + ')'; }
    else { st.invalid = (st.invalid || 0) + 1; by = 'code override: AI picked "' + String(next).slice(0, 40) + '", which is not allowed now'; if (st.invalid >= MAX_INVALID_PICKS) { st.planner_mode = 'deterministic'; by += ' (planner switched to the fixed order)'; } }
  }
}
st.steps = p.steps + 1; st.choice = choice;
st.plan_log = (p.plan_log || []).concat([{ step: st.steps, runnable: p.runnableNow, choice, by, why }]);
ev(p.need_llm ? 'llm' : 'code', 'plan_step', { step: st.steps, runnable: p.runnableNow, choice, by, why });
return [{ json: st }];
"""

JS_RUN_TOOL = CORE + r"""
// ===== Stage 4: act. One allow-listed tool per loop turn, arguments built by code, never by the model =====
const st = Object.assign({}, $json); st.trace = st.trace.slice();
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
const sd = $getWorkflowStaticData('global'); sd.mem = sd.mem || newMemory();
const sid = st.scenario.id;
if (TOOLS.indexOf(st.choice) < 0 || st.choice === 'finish') throw new Error('Tool not on the allow-list: ' + st.choice);
if (st.choice === 'read_meter_data') {
  const rec = get_local_meter_and_occupancy(sid), v = validateMeterRows(rec.rows, rec.now);
  st.data = { ok: v.ok, issues: v.issues, rows: v.rows, bad_values: v.bad_values || 0, newest_age_hours: v.newest_age_hours };
  st.state = v.ok ? { occupied: rec.now.occupied, outdoor_c: rec.now.outdoor_c } : null;
  ev('tool', 'read_meter_data', { stays_on_device: true, validation: st.data });
} else if (st.choice === 'run_leak_and_bill_forecaster') {
  const out = run_leak_and_bill_forecaster(sid); st.leak = out.leak; st.bill = out.bill;
  ev('tool', 'run_leak_and_bill_forecaster', { leak: out.leak.verdict, est_lph: out.leak.est_lph, month_bill_aed: out.bill.with_leak.total_aed, tariff_verified: TARIFF.verified });
} else if (st.choice === 'lookup_case_history') {
  st.history_info = lookupHistory(sd.mem, sid, st.request.type); ev('memory', 'lookup_case_history', st.history_info);
} else if (st.choice === 'check_safety_guard') {
  st.guard = heatGuard(st.request, st.state ? Object.assign({}, st.state, { device: st.device }) : null);
  ev('guard', 'heat_and_privacy_guard', { request: st.request, state: st.state, status: st.guard.status, rule: st.guard.rule, reason: st.guard.reason });
}
st.done = st.done.concat([st.choice]);
return [{ json: st }];
"""

JS_REPLAN_CHECK = CORE + r"""
// ===== Stage 6 -> 3: a plan the guard rejected goes back to the AI to replan. Hard cap: MAX_REPLANS = 2, then a person =====
const st = Object.assign({}, $json); st.trace = st.trace.slice();
delete st.replanBodies;
st.need_replan = needsReplan(st);
if (st.need_replan) {
  const s = sanitize(replanView(st), 'groq (replanner)'), user = JSON.stringify(s.payload);
  if (/occup|presence|room|people|schedule|empty/i.test(user)) throw new Error('Egress check failed in replan prompt');
  st.egress_log = st.egress_log.concat([Object.assign({ purpose: 'replan ' + ((st.replans || []).length + 1) }, s.egress)]);
  st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor: 'privacy', step: 'egress_filter', detail: s.egress });
  const system = 'You are the replanner inside EcoShield, a water and cooling saving agent for a school. Your first plan was rejected by a hard safety rule that you cannot see, cannot change and must not try to guess around. ' +
    'Propose ONE safer cooling setpoint in degrees C (a number; lower than original_setpoint_c if one is given; if the original request was to switch cooling off, propose a setpoint that still saves some energy). ' +
    'Do not repeat anything in failed_proposals. If you believe no safe alternative exists, answer NONE. You cannot approve or change anything; code checks your proposal. ' +
    'Reply with JSON only: {"action":"SETPOINT","setpoint_c":<number>,"why":"<=10 words"} or {"action":"NONE","why":"<=10 words"}.';
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  st.replanBodies = { groq: { model: 'openai/gpt-oss-120b', temperature: 0, max_tokens: 120, reasoning_effort: 'low', messages }, groq20: { model: 'openai/gpt-oss-20b', temperature: 0, max_tokens: 120, reasoning_effort: 'low', messages }, ollama: { model: 'qwen3:1.7b', stream: false, think: false, options: { temperature: 0, num_predict: 60 }, messages } };
}
return [{ json: st }];
"""

JS_PARSE_REPLAN = CORE + r"""
const p = $('Replan check').first().json, j = $json || {};
const st0 = Object.assign({}, p); ['replanBodies', 'need_replan'].forEach(k => delete st0[k]);
let provider = null, raw = '';
if (j.choices && j.choices[0] && j.choices[0].message) { provider = /gpt-oss-20b/i.test(String(j.model || '')) ? 'groq-20b' : 'groq'; raw = String(j.choices[0].message.content || ''); }
else if (j.message && j.message.content) { provider = 'ollama'; raw = String(j.message.content); }
return [{ json: applyReplan(st0, provider ? parseReplan(raw) : null, provider) }];
"""

JS_RECORD_REVIEW = CORE + r"""
// ===== Replan cap reached: a person looked at the reasons. A review cannot unblock a hard limit; it is recorded. =====
const d = $('Parse LLM').first().json, f = $json;
const st = Object.assign({}, d); st.trace = d.trace.slice();
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
st.review = recordReview(f['Decision'], f['Reviewer'], f['Note (optional)']); st.write = null;
ev('human', 'replan_review', { decision: st.review.decision, reviewer: st.review.reviewer, note: st.review.note || null, comment: st.review.comment });
ev('tool', 'write_gateway', { skipped: true, reason: 'the guard blocked the request; a review cannot override a hard limit' });
return [{ json: st }];
"""

JS_AUTO = CORE + r"""
// ===== Stage 7a: low-risk, inside every limit: runs automatically, still logged, still reversible =====
const st = Object.assign({}, $json); st.trace = st.trace.slice();
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
const v = st.leak ? st.leak.verdict : 'NOT_RUN';
if (st.request.type !== 'ROLLBACK' && st.data && st.data.ok && ['LEAK', 'WATCH', 'INSUFFICIENT_DATA'].indexOf(v) >= 0) {
  if ((st.device.alerts || []).some(a => a.open && a.scenario === st.scenario.id)) {
    st.auto = { status: 'NO_CHANGE', text: 'A leak alert is already open for this scenario, so it was not raised again.' };
  } else {
    const alert = { id: 'AL-' + st.run_id, scenario: st.scenario.id, verdict: v, est_lph: st.leak.est_lph || 0, at: new Date().toISOString(), open: true };
    const req = { type: 'RAISE_ALERT', alert };
    const g = heatGuard(req, Object.assign({}, st.state, { device: st.device }));
    const gw = g.status === 'AUTO' ? writeGateway(req, st.state, st.device) : { ok: false, error: 'guard did not allow it', device: st.device, before: st.device };
    if (gw.ok) { st.device = gw.device; st.auto = { status: 'DONE', alert, before: gw.before, after: gw.device }; } else st.auto = { status: 'FAILED', error: gw.error };
  }
  ev('tool', 'auto_action', { verdict: v, result: st.auto.status, alert: st.auto.alert ? st.auto.alert.id : null, note: st.auto.text || st.auto.error || 'alert written through the gateway; snapshot kept for undo' });
} else ev('code', 'auto_action', { skipped: true, reason: 'no leak verdict, or request is a rollback, or data untrusted' });
return [{ json: st }];
"""

JS_BUILD_LLM = CORE + r"""
const st = Object.assign({}, $json); st.trace = st.trace.slice();
const system = 'You are the explainer inside EcoShield, a water and cooling saving agent for a school. You receive RESULTS that plain code already computed. ' +
  'You do not decide anything, you cannot change anything, and you must never claim that you did. Use ONLY the numbers in the JSON; do not calculate new ones and do not invent any. ' +
  'If tariff_verified is false, say the AED figures use an assumed tariff. If leak_verdict is NOT_RUN, say no analysis was possible and explain the guard_reason. ' +
  'Write for a school manager: short sentences, plain words, no technical terms such as "guard", "gateway" or "allow-list"; say "safety rule" instead. ' +
  'Describe rules in words and never quote rule codes that contain underscores. Never suggest overriding, bypassing, relaxing or working around any safety rule, limit or approval, and never hint that a rule might allow the request later. If guard_status is BLOCKED, the only next step is that nothing was changed and a person decides. ' +
  'Reply with JSON only: {"headline":"<=12 words","explanation":"2-3 plain sentences: what was found and what it costs","tip":"one practical next step for a person"}.';
const s = sanitize(buildOutbound(st.scenario, st.leak, st.bill, st.guard, st.request), 'groq (cloud LLM)');
const user = JSON.stringify(s.payload);
if (/occup|presence|room|people|schedule|empty/i.test(user)) throw new Error('Egress check failed: occupancy-like text in the outbound payload');
st.outbound = s.payload; st.egress = s.egress;
st.egress_log = st.egress_log.concat([Object.assign({ purpose: 'explain' }, s.egress)]);
st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor: 'privacy', step: 'egress_filter', detail: s.egress });
st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor: 'privacy', step: 'egress_assertion', detail: { passed: true, outbound_bytes: user.length } });
const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
st.llm = { groqBody: { model: 'openai/gpt-oss-120b', temperature: 0, max_tokens: 700, reasoning_effort: 'low', messages }, groq20Body: { model: 'openai/gpt-oss-20b', temperature: 0, max_tokens: 700, reasoning_effort: 'low', messages },
  ollamaBody: { model: 'qwen3:1.7b', stream: false, think: false, options: { temperature: 0, num_predict: 350 }, messages } };
return [{ json: st }];
"""

JS_PARSE_LLM = r"""
const d = $('Build LLM prompt').first().json;
const j = $json || {};
const st = Object.assign({}, d); st.trace = d.trace.slice();
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
let provider = 'template', raw = '', tokens = null;
if (j.choices && j.choices[0] && j.choices[0].message) { provider = /gpt-oss-20b/i.test(String(j.model || '')) ? 'groq-20b' : 'groq'; raw = String(j.choices[0].message.content || ''); tokens = j.usage ? j.usage.total_tokens : null; }
else if (j.message && j.message.content) { provider = 'ollama'; raw = String(j.message.content); tokens = (j.prompt_eval_count || 0) + (j.eval_count || 0); }
const allowed = new Set(['24', '27', '10', '38']);
const walk = (v) => { if (typeof v === 'number') { allowed.add(String(v)); allowed.add(String(Math.round(v))); allowed.add(String(Math.round(v * 10) / 10)); } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
walk(d.outbound);
let llm = null, why = '';
if (provider !== 'template') {
  try {
    const m = raw.replace(/<think>[\s\S]*?<\/think>/g, '').match(/\{[\s\S]*\}/);
    const o = JSON.parse(m[0]);
    if (['headline', 'explanation', 'tip'].every(k => typeof o[k] === 'string' && o[k].trim())) {
      const text = o.headline + ' ' + o.explanation + ' ' + o.tip;
      const nums = (text.replace(/,/g, '').match(/\d+(\.\d+)?/g) || []);
      const bad = nums.filter(n => !allowed.has(n) && !allowed.has(String(Math.round(parseFloat(n)))) && !(Number.isInteger(parseFloat(n)) && parseFloat(n) <= 5));
      const BAD_ADVICE = /\b(overrid\w*|bypass\w*|work[- ]?arounds?|circumvent\w*|get(?:ting)? around|relax\w*|loosen\w*)\b/i;
      if (bad.length) why = 'AI quoted numbers it was never given: ' + bad.join(', ') + ' (text discarded)';
      else if (BAD_ADVICE.test(text)) why = 'AI text suggested getting around a safety rule (text discarded)';
      else {
        const words = (t) => String(t).replace(/[a-z]+(?:_[a-z]+)+/g, (m) => m.replace(/_/g, ' ')).trim();   // never show rule codes like cooling_off_in_heat
        llm = { headline: words(o.headline), explanation: words(o.explanation), tip: words(o.tip) };
        if ((d.guard && d.guard.status === 'BLOCKED') || d.gate === 'REJECT') llm.tip = 'Nothing was changed. A safety rule stopped this request; a person decides what happens next.';
      }
    } else why = 'AI reply missing fields';
  } catch (e) { why = 'AI reply was not valid JSON'; }
} else why = 'No AI provider answered (Groq and Ollama both failed or timed out)';
const o = d.outbound, L = d.leak || { verdict: 'NOT_RUN' };
const tmpl = {
  headline: L.verdict === 'LEAK' ? 'Probable leak: about ' + o.est_leak_lph + ' L/h flowing when the building is quiet' : (L.verdict === 'WATCH' ? 'Small constant night flow worth watching' : (L.verdict === 'INSUFFICIENT_DATA' ? 'Not enough meter data to judge leaks' : (L.verdict === 'NOT_RUN' ? 'No analysis possible: meter data rejected' : 'No leak found'))),
  explanation: (o.bill_total_aed !== null ? 'Forecast bill this month: AED ' + o.bill_total_aed + ' (assumed tariff' + (o.tariff_verified ? ', verified' : ', not verified') + '). ' : '') + (L.verdict === 'LEAK' ? 'The leak adds about AED ' + o.leak_bill_impact_aed + ' to this month. ' : '') + 'Safety check: ' + o.guard_reason,
  tip: o.guard_status === 'BLOCKED' ? 'No action is possible on this request; it was stopped by a hard rule.' : (L.verdict === 'LEAK' ? 'Have a person inspect the pipes and approve closing the main valve if needed.' : 'Review the request and approve or reject it.') };
ev('llm', 'explain', { provider_answered: provider, groq_failed_over_to_ollama: provider === 'ollama', tokens, used: llm ? 'ai_text' : 'plain_code_template', note: why || 'ok', words_only_no_decisions: true });
st.ai = { provider, text: llm || tmpl, from_ai: !!llm, note: why, tokens };
const h = d.history_info;
st.history_note = h && h.last_decision ? ' Earlier decision on this request: ' + (h.last_decision.approved ? 'approved' : 'rejected') + ' by ' + h.last_decision.reviewer + '.' : '';
return [{ json: st }];
"""

JS_APPROVE_WRITE = CORE + r"""
// ===== Stage 7b + 8: after the human answered, go through the ONE write gateway =====
const d = $('Parse LLM').first().json, f = $json;
const st = Object.assign({}, d); st.trace = d.trace.slice();
const ev = (actor, step, detail) => st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor, step, detail });
const rev = applyReview(f['Decision'], f['Reviewer'], f['Note (optional)']);
ev('human', 'approval', { decision: String(f['Decision']), reviewer: rev.reviewer, approved: rev.approved, note: rev.note, comment: rev.comment });
st.review = rev; st.write = null;
if (rev.approved) {
  st.write = writeGateway(st.request, st.state, st.device);
  ev('tool', 'write_gateway', { ok: st.write.ok, error: st.write.error || null, rolled_back: !!st.write.rolled_back, device_before: st.write.before, device_after: st.write.device });
} else ev('tool', 'write_gateway', { skipped: true, reason: rev.note || 'not approved by a named person' });
return [{ json: st }];
"""

JS_NO_WRITE = r"""
const st = Object.assign({}, $json); st.trace = (st.trace || []).slice();
const g = st.guard || {};
const reason = g.status === 'NO_CHANGE' ? 'nothing to change: already in that state' : (st.gate === 'REJECT' ? 'input rejected before any analysis: ' + g.rule : 'blocked by the guard before any approval was asked: ' + g.rule);
st.trace.push({ ts: new Date().toISOString(), run_id: st.run_id, actor: 'tool', step: 'write_gateway', detail: { skipped: true, reason } });
st.review = null; st.write = null;
return [{ json: st }];
"""

JS_SAVE_MEMORY = CORE + PAGE + r"""
// ===== Stage 5 (commit): all-or-nothing memory write. Failure leaves the old memory untouched =====
const d = Object.assign({}, $json); d.trace = d.trace.slice();
const sd = $getWorkflowStaticData('global');
const oc = outcome(d), at = new Date().toISOString();
if (d.special !== 'RESET') {
  const m = JSON.parse(JSON.stringify(sd.mem || newMemory())); const sid = d.scenario.id;
  try {
    if (d.gate === 'RUN') {
      m.devices[sid] = (d.write && d.write.ok) ? d.write.device : d.device;
      if (d.auto && d.auto.status === 'DONE') m.undo.push({ uid: d.run_id + ':RAISE_ALERT', run_id: d.run_id, scenario_id: sid, action: 'RAISE_ALERT', restore: d.auto.before, after: d.auto.after, at });
      if (d.write && d.write.ok) {
        if (d.request.type === 'ROLLBACK') m.undo = m.undo.filter(u => u.uid !== d.request.undo_run);
        else m.undo.push({ uid: d.run_id + ':' + d.request.type, run_id: d.run_id, scenario_id: sid, action: d.request.type, restore: d.write.before, after: d.write.device, at });
      }
      if (d.review) m.decisions.push({ scenario_id: sid, request_type: d.request.type, reviewer: d.review.reviewer, approved: d.review.approved, run_id: d.run_id, at });
    }
    m.undo = m.undo.slice(-20); m.decisions = m.decisions.slice(-50); m.runs = (m.runs || 0) + 1;
    d.trace.push({ ts: at, run_id: d.run_id, actor: 'memory', step: 'memory_commit', detail: { committed: true, runs: m.runs, undo_stack: m.undo.length, device_now: m.devices[sid] || null } });
    const keep = JSON.parse(JSON.stringify(d)); delete keep.llm;
    m.history.push({ run_id: d.run_id, at, scenario_id: sid, scenario_name: d.scenario.name, head: oc.head, tone: oc.tone, d: keep }); m.history = m.history.slice(-30);
    sd.mem = m;
  } catch (e) { d.trace.push({ ts: at, run_id: d.run_id, actor: 'memory', step: 'memory_commit', detail: { committed: false, error: String(e.message), note: 'rolled back, old memory kept' } }); }
} else d.trace.push({ ts: at, run_id: d.run_id, actor: 'memory', step: 'memory_reset', detail: { cleared: true } });
return [{ json: d }];
"""

JS_BUILD_PAGE = PAGE + r"""
const d = $json;
const oc = outcome(d);
const html = renderPage(d);
const final = d.trace.concat([{ ts: new Date().toISOString(), run_id: d.run_id, actor: 'tool', step: 'outcome', detail: { headline: oc.head, tone: oc.tone } }]);
const lines = final.map(t => JSON.stringify(t)).join('\n') + '\n';
const bin = await this.helpers.prepareBinaryData(Buffer.from(lines, 'utf8'), 'ecoshield_audit.jsonl', 'application/x-ndjson');
return [{ json: { run_id: d.run_id, headline: oc.head, html, events: final.length }, binary: { data: bin } }];
"""

JS_DASH = CORE + PAGE + r"""
const q = $json.query || {};
const sd = $getWorkflowStaticData('global'); const mem = sd.mem || newMemory();
let html;
if (q.run) {
  const h = (mem.history || []).find(x => x.run_id === q.run);
  html = h ? renderPage(h.d, { replay: true, at: h.at }) : shell('Not found', '<h1>Case not found</h1><p>No logged case with id ' + esc(q.run) + '. <a href="/webhook/ecoshield-dashboard">Dashboard</a></p>');
} else html = renderDashboard(mem);
return [{ json: { html } }];
"""

# ------------------------------------------------------------------- the graph
add("Console form", "n8n-nodes-base.formTrigger", {
    "formTitle": "EcoShield console",
    "formDescription": "Pick one of the demo scenarios. All building data is synthetic and stays on this laptop. UNDO and RESET are on the list too. Dashboard: http://localhost:5678/webhook/ecoshield-dashboard",
    "formFields": {"values": [
        {"fieldLabel": "Scenario", "fieldType": "dropdown", "requiredField": True,
         "fieldOptions": {"values": [{"option": l} for l in SCENARIO_LABELS]}},
        {"fieldLabel": "Operator note", "fieldType": "textarea", "requiredField": False,
         "placeholder": "Optional note from an operator or automation. It is treated as data and checked for injection."}]},
    "options": {}}, 0, 300, version=2.2, webhookId=CONSOLE_FORM_ID)
code("Validate input", JS_VALIDATE, 240, 300)
if_true("Input accepted?", "={{ $json.gate === 'RUN' }}", 480, 300)
code("Plan state", JS_PLAN_STATE, 720, 200)
if_true("Ask planner LLM?", "={{ $json.need_llm }}", 960, 200)
groq_http("Groq plan", "$json.planBodies.groq", 15000, False, 1200, 120)
groq_http("Groq 20B plan", "$('Plan state').first().json.planBodies.groq20", 15000, False, 1200, 210)
ollama_http("Ollama plan", "$('Plan state').first().json.planBodies.ollama", 60000, 1200, 300)
code("Parse plan", JS_PARSE_PLAN, 1440, 200)
if_true("Finished?", "={{ $json.choice === 'finish' }}", 1680, 200)
code("Run tool", JS_RUN_TOOL, 1680, 20)
code("Replan check", JS_REPLAN_CHECK, 1920, 200)
if_true("Replan needed?", "={{ $json.need_replan }}", 2160, 200)
groq_http("Groq replan", "$json.replanBodies.groq", 15000, False, 2400, 20)
groq_http("Groq 20B replan", "$('Replan check').first().json.replanBodies.groq20", 15000, False, 2400, -60)
ollama_http("Ollama replan", "$('Replan check').first().json.replanBodies.ollama", 60000, 2400, -140)
code("Parse replan", JS_PARSE_REPLAN, 2640, 20)
code("Auto actions", JS_AUTO, 2400, 200)
code("Build LLM prompt", JS_BUILD_LLM, 2640, 200)
groq_http("Groq explain", "$json.llm.groqBody", 30000, True, 2880, 200)
groq_http("Groq 20B explain", "$('Build LLM prompt').first().json.llm.groq20Body", 30000, True, 2880, 300)
ollama_http("Ollama explain", "$('Build LLM prompt').first().json.llm.ollamaBody", 90000, 2880, 400)
code("Parse LLM", JS_PARSE_LLM, 3120, 200)
if_true("Needs approval?", "={{ $json.guard.status === 'NEEDS_APPROVAL' }}", 3360, 200)
add("Approval form", "n8n-nodes-base.form", {
    "formFields": {"values": [
        {"fieldLabel": "Decision", "fieldType": "dropdown", "requiredField": True,
         "fieldOptions": {"values": [{"option": "Approve"}, {"option": "Reject"}]}},
        {"fieldLabel": "Reviewer", "fieldType": "text", "requiredField": True, "placeholder": "Your full name (goes in the audit trail)"},
        {"fieldLabel": "Note (optional)", "fieldType": "textarea", "requiredField": False, "placeholder": "Optional note for the audit trail. It is never sent to any AI."}]},
    "options": {"formTitle": "Human approval needed",
                "formDescription": "={{ 'Request: ' + ($json.request.type === 'SETPOINT' ? 'change cooling setpoint to ' + $json.request.setpoint_c + ' C' : $json.request.type.replace(/_/g, ' ').toLowerCase()) + '. Leak verdict: ' + ($json.leak ? $json.leak.verdict : 'not run') + '.' + $json.history_note + ($json.request_original ? ' This is the AI\\'s replan: the first plan was blocked by a hard rule.' : '') + ' Nothing changes unless you approve with your name.' }}"}},
    3600, 100, version=2.3, webhookId=uid("webhook:approval"))
if_true("Needs review?", "={{ $json.rp_done === 'review' }}", 3600, 420)
add("Review form", "n8n-nodes-base.form", {
    "formFields": {"values": [
        {"fieldLabel": "Decision", "fieldType": "dropdown", "requiredField": True,
         "fieldOptions": {"values": [{"option": "Acknowledge: keep current settings"}, {"option": "Escalate to the facilities manager"}]}},
        {"fieldLabel": "Reviewer", "fieldType": "text", "requiredField": True, "placeholder": "Your full name (goes in the audit trail)"},
        {"fieldLabel": "Note (optional)", "fieldType": "textarea", "requiredField": False, "placeholder": "Optional note for the audit trail. It is never sent to any AI."}]},
    "options": {"formTitle": "Human review: the AI could not find a safe plan",
                "formDescription": "={{ $json.review_text }}"}},
    3840, 600, version=2.3, webhookId=uid("webhook:review"))
code("Record review", JS_RECORD_REVIEW, 4080, 600)
code("Approve and write", JS_APPROVE_WRITE, 3840, 100)
code("No write", JS_NO_WRITE, 3840, 420)
code("Save memory", JS_SAVE_MEMORY, 4080, 300)
code("Build page", JS_BUILD_PAGE, 4320, 300)
add("Write audit log", "n8n-nodes-base.readWriteFile", {
    "operation": "write", "fileName": AUDIT_FILE, "dataPropertyName": "data", "options": {"append": True}},
    4560, 300, version=1.1)
add("Show result", "n8n-nodes-base.form", {
    "operation": "completion", "respondWith": "showText",
    "responseText": "={{ $('Build page').first().json.html }}",
    "completionTitle": "EcoShield result", "options": {}},
    4800, 300, version=2.3, webhookId=uid("webhook:result"))
# standing dashboard + replay from the log
add("Dashboard hook", "n8n-nodes-base.webhook", {"httpMethod": "GET", "path": "ecoshield-dashboard", "responseMode": "responseNode", "options": {}},
    0, 700, version=2, webhookId=uid("webhook:dashboard"))
code("Dashboard page", JS_DASH, 240, 700)
add("Respond HTML", "n8n-nodes-base.respondToWebhook", {
    "respondWith": "text", "responseBody": "={{ $json.html }}",
    "options": {"responseCode": 200, "responseHeaders": {"entries": [{"name": "Content-Type", "value": "text/html; charset=utf-8"}]}}},
    480, 700, version=1.4)

link("Console form", "Validate input")
link("Validate input", "Input accepted?")
link("Input accepted?", "Plan state", 0)
link("Input accepted?", "No write", 1)
link("Plan state", "Ask planner LLM?")
link("Ask planner LLM?", "Groq plan", 0)
link("Ask planner LLM?", "Parse plan", 1)
link("Groq plan", "Parse plan", 0)
link("Groq plan", "Groq 20B plan", 1)
link("Groq 20B plan", "Parse plan", 0)
link("Groq 20B plan", "Ollama plan", 1)
link("Ollama plan", "Parse plan", 0)
link("Ollama plan", "Parse plan", 1)
link("Parse plan", "Finished?")
link("Finished?", "Replan check", 0)
link("Replan check", "Replan needed?")
link("Replan needed?", "Groq replan", 0)
link("Replan needed?", "Auto actions", 1)
link("Groq replan", "Parse replan", 0)
link("Groq replan", "Groq 20B replan", 1)
link("Groq 20B replan", "Parse replan", 0)
link("Groq 20B replan", "Ollama replan", 1)
link("Ollama replan", "Parse replan", 0)
link("Ollama replan", "Parse replan", 1)
link("Parse replan", "Replan check")
link("Finished?", "Run tool", 1)
link("Run tool", "Plan state")
link("Auto actions", "Build LLM prompt")
link("Build LLM prompt", "Groq explain")
link("Groq explain", "Parse LLM", 0)
link("Groq explain", "Groq 20B explain", 1)
link("Groq 20B explain", "Parse LLM", 0)
link("Groq 20B explain", "Ollama explain", 1)
link("Ollama explain", "Parse LLM", 0)
link("Ollama explain", "Parse LLM", 1)
link("Parse LLM", "Needs approval?")
link("Needs approval?", "Approval form", 0)
link("Needs approval?", "Needs review?", 1)
link("Needs review?", "Review form", 0)
link("Needs review?", "No write", 1)
link("Review form", "Record review")
link("Record review", "Save memory")
link("Approval form", "Approve and write")
link("Approve and write", "Save memory")
link("No write", "Save memory")
link("Save memory", "Build page")
link("Build page", "Write audit log")
link("Write audit log", "Show result")
link("Dashboard hook", "Dashboard page")
link("Dashboard page", "Respond HTML")

workflow = {"id": WORKFLOW_ID, "name": "EcoShield Agent (Domain 5)", "nodes": nodes, "connections": conns, "pinData": {},
            "settings": {"executionOrder": "v1"},
            "meta": {"note": "Generated by make_ecoshield_workflow.py v2 from core.js + page_js.js; synthetic data; assumed tariff"}}

if os.environ.get("ECO_PROBE") == "1":   # temporary test build: adds GET /webhook/ecoshield-probe that lists the Groq models this key can use (read-only)
    OUT = os.path.join(HERE, "tests", "probe_workflow.json")
    add("Probe hook", "n8n-nodes-base.webhook", {"httpMethod": "GET", "path": "ecoshield-probe", "responseMode": "responseNode", "options": {}}, 0, 1000, version=2, webhookId=uid("webhook:probe"))
    add("Probe models", "n8n-nodes-base.httpRequest", {"method": "GET", "url": "https://api.groq.com/openai/v1/models", "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth", "options": {"timeout": 15000}}, 240, 1000, version=4.2, credentials={"httpBearerAuth": GROQ})
    add("Probe respond", "n8n-nodes-base.respondToWebhook", {"respondWith": "json", "responseBody": "={{ JSON.stringify(($json.data || []).map(m => m.id)) }}", "options": {}}, 480, 1000, version=1.4)
    link("Probe hook", "Probe models")
    link("Probe models", "Probe respond")

if os.environ.get("ECO_GROQ_MAIN_BAD") == "1":   # test build: main Groq model name is wrong, so Groq answers 400 and the 20B link must take over
    OUT = os.path.join(HERE, "tests", "groq20b_workflow.json")
    for n in nodes:
        if "jsCode" in n["parameters"]:
            n["parameters"]["jsCode"] = n["parameters"]["jsCode"].replace("openai/gpt-oss-120b", "openai/gpt-oss-120b-nope")

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(workflow, f, indent=1)
    print("wrote", OUT, len(nodes), "nodes; audit file:", AUDIT_FILE)
