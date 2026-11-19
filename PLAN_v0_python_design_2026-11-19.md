# PLAN.md: EcoShield master specification

*Written 2026-11-19 for TechX Dubai'26, Domain 5 High School Track. Feed this file to the AI coding agent. Statement source: the emailed .docx (summarised in `../STATEMENT_ANALYSIS.md`). Anything marked **ASSUMPTION** is my default, not something the organisers said; confirm it (list in section 6).*

## 0. Ground rules for the coding agent (read first)

1. **Code decides, the LLM talks.** Every number, detection, forecast, limit and approval is plain Python. The LLM only (a) explains, (b) turns numbers into tips, (c) drafts alerts, (d) *proposes* a setpoint change that the guards then accept or block.
2. **No raw occupancy ever leaves the process.** One function (`privacy_filter.sanitize`) is the only way to build an outbound LLM payload. Tests prove it.
3. **Heat-safety limits are constants in one file** (`guards/heat_guard.py`) and no LLM output can change them.
4. Never add features not in this plan without asking. Never spend money; free tiers only. Never commit secrets (`.env` is git-ignored).
5. Build in the phase order below. After each phase: run tests, run the app, stop at the named Human Checkpoint.

## 1. System architecture and stack

### Data flow
```
SQLite (smart_resource_meters.sqlite)  ← generate_dataset.py (10 scenarios)
        │  local only
        ▼
services/tools.py ─ get_local_meter_and_occupancy()   → full local record (has occupancy)
                  ─ run_leak_and_bill_forecaster()    → leak verdict + slab-by-slab bill (pure Python)
                  ─ stage_cooling_setpoint_change()   → creates a STAGED action, never executes
        │
        ▼
agent/orchestrator.py   per scenario: call tools → run guards → build sanitized payload → LLM → result object
        │                                   │
        │                         guards/privacy_filter.py  (strips occupancy, writes egress log)
        │                         guards/heat_guard.py      (24 °C occupied, 27 °C unoccupied, no AC-off in heat)
        │                         guards/approval.py        (setpoint change + main-valve shutoff wait for a human)
        ▼
agent/llm_client.py   Ollama qwen3 (local, optional)  →  Groq gpt-oss-120b  →  Gemini flash-lite (fallbacks)
        ▼
app/streamlit_app.py  dashboard: 10 scenario buttons, charts, slab table, privacy panel, guard panel, approval queue
```

### Stack (hackathon defaults; the statement's own baseline)
- Python 3.11+, SQLite (stdlib `sqlite3`), pandas, Streamlit (dashboard), pytest.
- LLM: `requests` to Groq (`openai/gpt-oss-120b`, free tier) with Gemini fallback; optional local Ollama `qwen3` (statement says it will be pre-arranged). **ASSUMPTION:** cloud LLMs only ever receive sanitized data; local Ollama may receive the full record (that is the privacy story: the only model that sees occupancy runs on the device).
- Third-party services: Groq API key, Gemini API key (both free), nothing else. No paid services.
- Not using n8n here (see `../STATEMENT_ANALYSIS.md`); **ASK** organisers if n8n is allowed. EcoWatch stays a design reference.

## 2. Project structure

```
ecoshield/
├── PLAN.md                      (this file)
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
├── config/
│   ├── tariff.json
│   └── limits.py
├── data/
│   ├── generate_dataset.py
│   └── smart_resource_meters.sqlite   (generated, committed so the demo works offline)
├── services/
│   └── tools.py
├── core/
│   ├── leak_detector.py
│   ├── bill_forecaster.py
│   └── db.py
├── guards/
│   ├── privacy_filter.py
│   ├── heat_guard.py
│   └── approval.py
├── agent/
│   ├── llm_client.py
│   ├── prompts.py
│   └── orchestrator.py
├── app/
│   └── streamlit_app.py
├── tests/
│   ├── test_leak_detector.py
│   ├── test_bill_forecaster.py
│   ├── test_heat_guard.py
│   ├── test_privacy_filter.py
│   ├── test_approval.py
│   └── test_scenarios.py
└── docs/
    ├── DEMO_SCRIPT.md
    └── ARCHITECTURE.md
```

### File by file

**`requirements.txt`**: `streamlit`, `pandas`, `requests`, `python-dotenv`, `pytest`. Nothing else.

**`.env.example`**: `GROQ_API_KEY=`, `GEMINI_API_KEY=`, `OLLAMA_URL=http://localhost:11434`, `LLM_MODE=auto` (auto/local/cloud/off). `.env` itself is git-ignored.

**`config/limits.py`**: the safety constants and nothing else: `OCCUPIED_MAX_SETPOINT_C = 24`, `UNOCCUPIED_PRECOOL_MAX_C = 27`, `HEAT_HOURS_OUTDOOR_C = 38` (outdoor temperature at or above which turning cooling off while occupied is blocked, **ASSUMPTION**), `LEAK_MIN_FLOW_LPH`, `LEAK_MIN_CONSECUTIVE_HOURS`, `NIGHT_HOURS`. Imported by guards and detector. Inputs: none. Outputs: constants.

**`config/tariff.json`**: electricity and water slabs plus fees, each with a `source` and `verified: false`. Electricity (consistent across several secondary guides, **not yet checked against DEWA**): 0-2000 kWh 0.23, 2001-4000 0.28, 4001-6000 0.32, above 6000 0.38 AED/kWh, progressive; fuel surcharge about 0.065 AED/kWh varies monthly. Water: sources disagree (about 3 / 3.5 / 4 fils per gallon over 6,000 / 12,000-gallon steps, a fourth tier in some guides, and other guides quote per cubic metre). **Do not hard-code one as fact**: keep it in this file, label it on the dashboard as "assumed tariff, source: ...". A school may be on a commercial tariff, which differs; **ASK**.

**`data/generate_dataset.py`**: builds `smart_resource_meters.sqlite`. Tables: `scenarios(id, name, description, site_type, month_start_day, today_day, requested_action_json)`, `meters_hourly(scenario_id, ts, water_lph, kwh, occupied INTEGER, outdoor_c, indoor_setpoint_c)`. Deterministic (seeded), 30 days x 24 h per scenario. Defines the 10 scenarios in section 4. Run once; output is committed. Inputs: `config/limits.py`. Outputs: the .sqlite file. Depends on nothing else.

**`core/db.py`**: `get_scenario(id)`, `get_hourly(id)` returning a DataFrame. Only module that touches SQLite.

**`core/leak_detector.py`**: `detect_leak(hourly_df) -> dict`. Rule: during night hours with `occupied == 0`, if flow stays at or above the minimum for N consecutive hours on at least M nights (or across the weekend), it is a leak. Returns `{leak: bool, severity, est_litres_per_day, first_seen, evidence_rows, reason}`. Cleaning-crew nights (occupied flag 1) are not leaks; incomplete data returns `insufficient_data`. Pure function, no LLM.

**`core/bill_forecaster.py`**: `forecast_bill(hourly_df, tariff, today_day, days_in_month, leak_fixed=False) -> dict`. Month-to-date plus projection of the remaining days, then **progressive slab calculation** that returns every step (`slab, units_in_slab, rate, cost`) so the dashboard can show the working. Also returns "without the leak" and "with the leak" totals so the alert can state the bill impact. Pure function.

**`guards/privacy_filter.py`**: `sanitize(payload: dict) -> dict` removes or aggregates `occupied`, any room/occupancy schedule keys, and anything not on an explicit allow-list of field names (allow-list, not block-list). `send_external(payload, destination)` is the only function the LLM client may call for cloud requests; it sanitizes, writes a row to an in-memory + file egress log (`destination`, field names sent, byte count, timestamp) and returns the clean payload. Raises `PrivacyViolation` if occupancy survives. The dashboard's privacy panel reads this log.

**`guards/heat_guard.py`**: `check_setpoint_change(request, state) -> Decision` with rules in order, first match wins, each named: `occupied_over_limit` (occupied and requested setpoint above 24 °C: BLOCK, propose 24), `unoccupied_over_precool_ceiling` (unoccupied and above 27 °C: BLOCK, propose 27), `cooling_off_in_heat` (cooling off while occupied and outdoor at or above `HEAT_HOURS_OUTDOOR_C`: BLOCK), else `needs_approval` (any allowed change still goes to a human). Deterministic. Overrides any LLM or energy-saving suggestion.

**`guards/approval.py`**: staged-action queue (SQLite table `staged_actions` or in-memory list). `stage(action)`, `approve(id, reviewer)`, `reject(id, reviewer)`. Reviewer name required (an approval without a real name counts as not approved, same rule as EcoWatch). Types: `COOLING_SETPOINT`, `MAIN_WATER_SHUTOFF`. Nothing is ever executed; "approved" is a status.

**`services/tools.py`**: the three statement-named functions, thin wrappers: `get_local_meter_and_occupancy(scenario_id)` (returns full local data, never called with an external destination), `run_leak_and_bill_forecaster(scenario_id)` (calls `core`), `stage_cooling_setpoint_change(scenario_id, requested_setpoint_c, action)` (runs `heat_guard`, then `approval.stage` only if allowed). Plus `stage_main_water_shutoff(scenario_id)` which always needs approval. The orchestrator may call only these.

**`agent/llm_client.py`**: `complete(system, user_payload, purpose)`; chooses local Ollama, then Groq, then Gemini on error/429; **every cloud call goes through `privacy_filter.send_external`**. Returns text plus which provider answered and token counts. Falls back to a plain template text if every provider fails (the demo must never stall).

**`agent/prompts.py`**: system prompts. (1) Explain leak in plain language from the verdict dict. (2) Turn the bill forecast into 2 to 3 saving tips. (3) Draft a maintenance alert. (4) *Propose* a setpoint action from the forecast, JSON out. Each prompt states "you only see the numbers provided; never invent readings".

**`agent/orchestrator.py`**: `run_scenario(id) -> ScenarioResult`: get local data, run forecaster, run leak detector, build sanitized payload, call LLM for explanation/tips/alert, get the LLM's proposed action (or the scenario's scripted request), run it through the guards, collect a `trace` list (step, who did it: "code" or "LLM", result). The `trace` is what makes the LLM/code separation visible.

**`app/streamlit_app.py`**: sidebar with 10 scenario buttons and a provider status line. Main panels: (1) hourly water/electricity chart with the night window shaded, (2) Leak verdict and evidence, (3) Bill forecast with the slab table and "with leak vs without leak", (4) Privacy panel: "kept on device: occupancy columns" vs "sent outside: field list" from the egress log, (5) Heat-safety panel: request, rule fired, decision, (6) Approval queue with Approve/Reject and a required reviewer name, (7) LLM text labelled "written by the LLM" and the code results labelled "computed by code", (8) trace.

**`tests/*`**: `test_leak_detector` (leak found; cleaning crew not a leak; drip below threshold; gap data), `test_bill_forecaster` (hand-computed slab totals for known inputs), `test_heat_guard` (each rule, boundaries 24/24.1/27/27.1), `test_privacy_filter` (no `occupied` key survives for any payload; allow-list works; a monkeypatched HTTP call is inspected to confirm nothing occupancy-related is in the body), `test_approval` (blank reviewer cannot approve), `test_scenarios` (all 10 give the expected verdict/decision).

**`docs/DEMO_SCRIPT.md`**: 4-minute script, the order of the 10 scenarios, what to say about LLM vs code, honest limits. **`docs/ARCHITECTURE.md`**: one page for judges (reuse the wording style of EcoWatch's note). **`README.md`**: run instructions in 5 lines.

## 3. Build order

### Phase 1: Setup, data, tariff (about 25 min on the day if code may be pre-written, otherwise this is what to prepare tonight)
**Must:** folder, venv, requirements, `.gitignore`, `limits.py`, `tariff.json`, `generate_dataset.py`, `db.py`. Verify: sqlite has 10 scenarios x 720 rows.
**HUMAN CHECKPOINT 1:** you review the 10 scenario list and tariff numbers; confirm limits (24/27) with the organisers.

### Phase 2: Core logic (about 35 min)
**Must:** `leak_detector.py`, `bill_forecaster.py`, their tests. Pass before going on.

### Phase 3: Guards and tools (about 30 min)
**Must:** `heat_guard.py`, `privacy_filter.py`, `approval.py`, `tools.py`, tests.
**HUMAN CHECKPOINT 2:** you read `heat_guard.py` and `privacy_filter.py` line by line (judges may ask) and decide the unsure rules (clamp vs block; outdoor threshold).

### Phase 4: LLM and orchestrator (about 25 min)
**Must:** `llm_client.py` (Groq first, template fallback), `prompts.py`, `orchestrator.py`. First happy path: scenario 1 end to end in the terminal.
**HUMAN CHECKPOINT 3:** you supply `.env` keys, run once, and check the LLM text matches the numbers (no invented figures).

### Phase 5: Dashboard (about 30 min)
**Must:** the Streamlit panels above, all 10 scenarios clickable.
**HUMAN CHECKPOINT 4:** you click through all 10 and approve the layout, or cut panels.

### Phase 6: Demo polish and stretch (remaining time)
**Must:** `DEMO_SCRIPT.md`, a screenshot backup of each scenario, rehearsal.
**Nice-to-have, in this order only if everything above passes:** tariff-aware pre-cooling suggestion (LLM proposes, heat guard checks); Ollama local mode; leaderboard (litres and CO2 saved, computed in code); irrigation advisor. **HUMAN CHECKPOINT 5:** cut scope if less than 30 minutes remain; never start a stretch goal with failing tests.

## 4. The 10 scenarios (to be built into the dataset)

| # | Scenario | Expected result |
|---|---|---|
| 1 | Overnight hidden pipe leak, steady 45 L/h at 2 AM, building empty | Leak detected; bill impact stated |
| 2 | Normal consumption month | No leak; baseline forecast |
| 3 | Weekend-long leak (Fri night to Mon) | Leak, severity higher, first_seen found |
| 4 | Small drip (about 6 L/h, under threshold) | Not a leak by the rule; noted as watch (shows the threshold is a design choice) |
| 5 | Night cleaning crew using water (occupied=1) | Not a leak (no false alarm) |
| 6 | 46 °C afternoon, exam hours, request to switch AC off to save money | Heat guard BLOCKS (`cooling_off_in_heat`) |
| 7 | Unoccupied pre-cooling request at 30 °C | BLOCKED (`unoccupied_over_precool_ceiling`), proposes 27 |
| 8 | High electricity month crossing into a higher slab | Slab table shows the jump; saving tips |
| 9 | Missing meter hours (data gap) | `insufficient_data`; no confident forecast |
| 10 | Request to send room-by-room occupancy schedule to a cloud model | Privacy filter strips it; egress log shows what left |

Scenario 6 and 7's requests come from the scripted `requested_action_json` and, in a second pass, also from the LLM's own proposal. Test with a hostile LLM output (it proposes 30 °C occupied) and confirm the guard still blocks.

## 5. AI coding agent handoff prompts

Use one per phase. Always attach `PLAN.md` first.

**Phase 1**
> Read PLAN.md fully. Build Phase 1 only: folder structure, requirements.txt, .env.example, .gitignore, config/limits.py, config/tariff.json (use the values in PLAN.md, mark verified false), data/generate_dataset.py (seeded, 10 scenarios exactly as in the table, 30 days x 24 hours), core/db.py. Do not write any other file. Run the generator and print the row counts per scenario. Stop and wait for my Human Checkpoint 1 review.

**Phase 2**
> Phase 1 is approved. Build core/leak_detector.py and core/bill_forecaster.py exactly as specified in PLAN.md section 2, plus tests/test_leak_detector.py and tests/test_bill_forecaster.py. The bill test must contain at least two hand-computed progressive slab examples with the arithmetic in comments. Run pytest. Do not touch other files. Report results and stop.

**Phase 3**
> Phase 2 passes. Build guards/privacy_filter.py (allow-list, egress log, PrivacyViolation), guards/heat_guard.py (rules in the stated order, named, boundary tests at 24/24.1/27/27.1), guards/approval.py (reviewer name required), services/tools.py (the three named functions plus the shutoff stage function) and their tests. The privacy test must monkeypatch requests and assert that no occupancy-related key or value appears in any outgoing body. Run pytest, show me the diff of heat_guard.py and privacy_filter.py, and stop for Human Checkpoint 2.

**Phase 4**
> Phase 3 is approved. Build agent/llm_client.py (Ollama if reachable, then Groq, then Gemini, then a plain template; every cloud call must go through privacy_filter.send_external), agent/prompts.py, agent/orchestrator.py with a trace marking each step as "code" or "LLM". Add tests/test_scenarios.py covering all 10 scenarios with the LLM disabled (LLM_MODE=off). Then run scenario 1 in the terminal and show me the trace. Stop for Human Checkpoint 3. Do not read or print the .env file.

**Phase 5**
> Phase 4 is approved. Build app/streamlit_app.py with the eight panels in PLAN.md section 2. Code results and LLM text must be visibly labelled differently. All 10 scenarios must run from the sidebar without restarting. Do not add features beyond the plan. Tell me the command to run it and stop for Human Checkpoint 4.

**Phase 6**
> Phase 5 is approved. Write docs/DEMO_SCRIPT.md, docs/ARCHITECTURE.md and README.md using only facts that the tests and the app demonstrate; state limits honestly (self-generated data, assumed tariff, no real devices). Then, only if all tests pass, implement stretch goal 1 (pre-cooling suggestion proposed by the LLM and checked by the heat guard). Stop for Human Checkpoint 5.

**Fix prompt (any phase)**
> This test/behaviour is wrong: <paste output>. Fix only that, do not refactor other files, rerun the full test suite, and show me exactly what changed.

## 6. Assumptions to confirm

1. Python build, not n8n (needs organisers' answer).
2. Limits 24 °C occupied and 27 °C unoccupied are exact; the 38 °C outdoor threshold for "no cooling off while occupied" is my invention.
3. Tariff: DEWA-style slabs from secondary sources, unverified; a school may be commercial; water slabs especially uncertain.
4. Blocking (not clamping) an unsafe setpoint, with a safe value suggested.
5. Streamlit for the dashboard (Gradio is also allowed).
6. Cloud LLMs see only sanitized, aggregated numbers; local Ollama may see full data.
7. You may pre-write code before the event (the statement only clearly allows pre-building the dataset). If not allowed, Phase 1 prep is the dataset and tariff only, and Phases 2 to 5 must fit in the 2.5 hours on site.
8. Team of about four, one laptop for the demo; installs (pip, Streamlit, Ollama) are your decision and need your go-ahead.
9. 10 scenarios of 30 days at hourly resolution are enough.

*Honest limits to state in the demo:* data is synthetic, the tariff is assumed, nothing controls a real device ("staged" means staged), occupancy privacy is enforced in our code path, not proven for the whole machine.

## 7. Alignment with the official TechX Agentic AI Manual (read 2026-11-19, 33 pages)

The manual's demo checklist is what judges are told to expect. Gaps between this plan and it, and the fix:

| Manual checklist item | Status in this plan | Add |
|---|---|---|
| Runs end to end on a local Ollama model | Optional only | Make Ollama the **last link of the fallback chain** and test the whole pipeline once with `LLM_MODE=local` (qwen3:4b needs about 2.5 GB, 8 GB RAM minimum) |
| Input validated, injection blocked | Inputs are meter data, not free text | Put at least one **text field** in the data (e.g. a maintenance-note column) and plant an injection in one scenario so the injection shield can be shown. Cheap, and the manual explicitly lists attack cases as good test data |
| Guards in code, not the LLM | Yes | none |
| Risky actions pause for a human | Yes (setpoint, valve) | none |
| **Every change goes through one write function that can roll back** | Not yet | `stage_cooling_setpoint_change` becomes the single write gateway: re-checks the heat limits a second time inside a SQLite transaction, rolls back on failure. Add a test that forces a failure and asserts the rollback |
| Keys in `.env` / .gitignore | Yes | none |
| At least two providers as fallbacks, ending with Ollama | Groq, Gemini | Add Ollama at the end; manual also suggests a second Groq model (own limit) and Cerebras |
| Loop steps, retries, answer length capped | Partly | `MAX_LLM_STEPS`, `max_tokens`, `MAX_REPLANS = 2` (hand to human after that) in `limits.py` |
| Every input, tool call, decision, **approver** logged | Trace + egress log | Persist the trace and approver to a `audit_log` SQLite table |
| Timeout and low retry on every API call | Not stated | 30 s timeout (60 s for Ollama), max 1 retry, in `llm_client.py` |

Other points from the manual that shape the build:
- **Judging emphasis (manual, last page):** safe, reliable, easy to explain; show things going wrong, not just right. The demo is a safe case, a case needing approval, and a blocked attack. Scenarios 6, 7 and 10 are exactly that.
- **Test data:** mostly normal cases, edge cases (missing, stale, duplicate, values right on a threshold), attack cases, and an expected answer per row. 50 to 200 rows is enough. Our 10 scenarios have expected results; add one boundary row at exactly 24.0 and 27.0.
- **Rate limits** are per account, not per key; Groq limits are per model. Cap tokens and pace calls.
- **Privacy of test data:** free tiers may use prompts to improve models, so never send real data. All our data is synthetic.
- **n8n is a supported path in the manual** ("build your whole agent in n8n", or mix n8n with a Python tool). The manual assumes n8n self-hosted (`npx n8n` or Docker, Node 20.19 to 24) or cloud. See the decision note in `../STATEMENT_ANALYSIS.md`.
- **Coding agent:** the manual's playbook uses Google Antigravity (Gemini 3.8 Flash free tier; the student plan needs university-age users, so it does not apply to under-18s, the free tier still works) with the same PLAN.md method. Any coding agent is acceptable per the master prompt wording.
