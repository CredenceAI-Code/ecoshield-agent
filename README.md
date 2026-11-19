# EcoShield (Domain 5) in local n8n: v3, what exists and how to run it

Built 2026-11-19. Synthetic data, **assumed** tariff. Everything below was run, not just written.

## Run it
- Console form: `http://localhost:5678/form/be2bf8f1-b886-4585-950c-82bcc0648882` (pick a scenario; optional operator note).
- Dashboard + replay: `http://localhost:5678/webhook/ecoshield-dashboard` (scenario cards, "Run this scenario" links, Undo, Reset, replay any past case from the log).
- Workflow id `va1J6ZZ2bCfcd2mT`, **published** on local n8n. Start n8n if it is down: `npx -y n8n@2.48.6 start` (about 600 MB RAM; close Chrome tabs if Ollama is loaded too).
- Memory only persists for PUBLISHED (production) runs, not "Execute workflow" test runs in the editor.
- Demo reset: pick "RESET - clear the demo memory" on the console form (devices reopened, history and undo stack emptied).

## The 10 stages of the reference diagram, and where each lives
| # | Stage | Done by | What is built |
|---|---|---|---|
| 1 | Trigger | **Human starts, code receives** | n8n Form (a request) with 14 scenarios + UNDO + RESET + optional note. Dashboard webhook for viewing and replay. |
| 2 | Validate and sanitise | **Code** | `Validate input`: note checked for injection (override/skip-approval/secrets/commands, hidden characters, length) BEFORE any tool or model. `read_meter_data`: schema, range, duplicate and freshness check on the feed. Privacy allow-list on every outbound AI call. |
| 3 | Plan | **AI picks order, code enforces** | `Plan state` / `Parse plan`: Groq (then a second Groq model, then Ollama) chooses the next tool from an allow-list that CODE computes. Wrong pick or early "finish" is overridden; after 2 bad picks or a planner outage it switches to a fixed order; hard cap 8 steps. |
| 4 | Act (loop) | **Code (AI only chose which tool)** | `Run tool`: 4 allow-listed tools (read_meter_data, run_leak_and_bill_forecaster, lookup_case_history, check_safety_guard). Arguments are built by code. Loop 3-4 repeats until the guard check has produced the proposed action. |
| 5 | Remember state | **Code** | n8n workflow static data (stored in n8n's own database, survives restarts, verified): per-scenario device state, last 30 cases, decision history, undo stack. Used: repeats are detected (no repeated alert, no repeated approval), earlier decisions shown to the approver, committed all-or-nothing. |
| 6 | Guard check in code | **Code only, never the AI** | `heatGuard` in core.js: 24 C occupied, 27 C pre-cooling, no cooling-off in heat (38 C is MY assumption), privacy export block, fail-closed on untrusted data, NO_CHANGE if already in state. |
| 6b | Replan loop (v3) | **AI proposes, code decides, human after the cap** | A fixable block (a setpoint over a ceiling, cooling off in heat) goes back to the AI: it proposes ONE safer setpoint or NONE, the guard re-checks it. **Capped at 2 replans** (manual p16-17, p33), then a named person reviews the reasons (Acknowledge or Escalate; a review can never unblock a hard limit). Broken JSON counts as an attempt. Privacy, injection and untrusted-data blocks are never replanned (an AI cannot fix them). The AI is told no limit values and no rule names. A passing proposal still needs human approval and the gateway. |
| 7a | Safe: automatic | **Code** | Leak/watch/insufficient-data raises an alert automatically through the write gateway. Logged, snapshot kept, undoable. |
| 7b | Risky: human | **Human** | n8n approval form, Approve/Reject plus a required reviewer name (blank = not approved). Setpoint changes, valve shutoff and rollbacks all need it. |
| 8 | One write gateway | **Code** | `writeGateway`: the only function that changes state; re-checks every limit, snapshot first, rolls back on any failure. Changes a SIMULATED device record, not real hardware. |
| 9 | Log and report | **Code (AI wrote only the explanation text)** | `ecoshield_audit.jsonl` (every input, tool call, plan step, AI call with fields sent, decision, approver, memory commit) + a per-run report page. |
| 10 | Demo and explain | **Code + human** | Per-run page (safe case, approval case, blocked case, injection case, corrupt feed) + standing dashboard + replay from the stored log with zero tools or AI re-run. |

## Files
- `PLAN.md` the plan AS BUILT (rewritten after the build; the original pre-code Python plan is `PLAN_v0_python_design_2026-11-19.md`). `core.js` all plain-code logic; `page_js.js` page builders; `make_ecoshield_workflow.py` -> `ecoshield_workflow.json` (37 nodes, deterministic ids). Dated copies `EcoShield_Agent_export_2026-11-19_v1.json` (first build), `_v2.json`, `_v3.json` (replan loop, 127.0.0.1 fix), `_v4.json` (14 scenarios, 20B link, approver note).
- `data/smart_resource_meters.csv` (6,195 hourly rows, 12 scenarios), `data/scenarios.csv`, `data/sample_audit_excerpt.jsonl` (from v1).
- Tests: `tests/test_core.js` (155), `tests/sim_workflow.js` (202; the REAL graph in a mini engine with stubbed AI incl. bad/failing replies), `tests/live_run.js` (83, run once with Groq and once with Groq switched off so Ollama alone does everything; `tests/ollama_only_workflow.json` is that copy, built with `ECO_OLLAMA_ONLY=1 python make_ecoshield_workflow.py`; the live n8n with real Groq: all 12 scenarios, repeat, undo x2, empty undo, replay, dashboard, typed injection, blank reviewer), `tests/live_persist.js`.

## Scenarios
1-10 are the statement's ten. 11 (prompt injection in an automation note), 12 (corrupt and stale feed), 13 (setpoint exactly on the 27 C limit: allowed) and 14 (two water meters disagree: feed untrusted) are bonus edge cases I added. In 4, 5, 8, 9 the routine request is a 23 C setpoint (24 C would be a no-op, which the system now correctly recognises as "no change needed").

## NOT settled, do not present as fact
- **Tariff** is from secondary web guides, not DEWA; water tiers conflict between sources; a school may pay a commercial rate. The pages say "ASSUMED, not verified".
- **38 C** cooling-off limit is my guess. The statement gives 24 C and 27 C as "e.g.". Ask the organisers.
- Leak thresholds (10 L/h, 2 flagged nights or a 24 h run, window 01:00-05:00) are my choices, tuned on my own synthetic data, so passing all scenarios is not an accuracy claim.
- Bill forecast is a naive projection, not a prediction.
- The planner chooses ORDER and whether to look up history; code decides what is allowed and when to stop. It is a real LLM-in-the-loop, but a bounded one. A normal run uses 1-2 planner calls and 1 explain call (about 7-11 s with Groq).
- Memory is n8n static data, not SQLite. Two runs paused at the approval step at the same time could overwrite each other's memory (not tested). Do one approval at a time.
- The audit file is local-only and DOES contain occupancy state; only the sanitized payload goes to Groq (shown on every page).
- Unknown until the organisers answer: whether pre-built code/workflows are allowed on the day, what is submitted at 12:30.

## v3 additions (2026-11-19)
- Replan loop capped at 2, then a person (stage 6b above). On Groq the first proposal usually passes; on the small local model it often fails twice and the cap sends the case to a person, which is exactly what it is for.
- The whole pipeline was run on local Ollama (qwen3:1.7b) with Groq off: 72 checks passed. Each scenario takes about 40-70 s that way (about 10 s with Groq).
- Fixed: n8n could not reach Ollama at `localhost` (IPv6). The URL is now `http://127.0.0.1:11434`. On a different laptop, check with scenario 1 and Groq off before relying on the fallback.
- Cost to know: the replan AI call happens only for the two fixable blocks (scenarios 6 and 7), 1-2 extra calls.
- Still not settled: approval timeout default and a conflict check are NOT built. A 1.7b model is weak; the manual recommends qwen3:4b for 8 GB RAM, but free RAM here is under 1 GB with Chrome open, so 1.7b was kept.
- Fallback chain is now Groq gpt-oss-120b -> Groq openai/gpt-oss-20b (own rate limit) -> Ollama qwen3:1.7b -> plain-code template. The 20B link is tested with stubs and live (main model deliberately broken: the 20B planned, explained and replanned). NOTE: the manual's `llama-3.1-8b-instant` returns 404 on this account; the models this key can use were listed through n8n and gpt-oss-20b was chosen.
- Approval and review forms have an optional Note. It goes to the audit log and the page (HTML-escaped) and to no AI.

## Quota test (2026-11-19, `tests/quota_run.js`)
3 rounds of all 14 scenarios back to back, no pauses: 42 runs in 12 min 17 s. Every planner call (144) and 38 of 39 explanations were answered by the main Groq model; 3 runs made no AI call by design (injection rejected up front); 1 run used the plain-code template (cause not investigated; most likely the number guard discarding AI text). n8n's own execution records show 0 rate-limit (429) errors. About 20k tokens were counted on the explanation calls; planner tokens are not shown on the page. This proves one burst on one free key at this moment, not a guarantee: limits change, so repeat it on the day before the demo.
