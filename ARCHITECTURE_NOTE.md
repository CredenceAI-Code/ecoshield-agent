# EcoShield Agent (Domain 5): how it works
**On the n8n canvas every node name starts with its number, for example `1) Console form`, `2) Validate input`, `19b) Cloud call allowed?`, `37) Respond HTML`. The numbers match the node numbers in the Node Notes. This document uses the plain names.**


*Architecture note for judges. Written 2026-11-19 against the built workflow (v6, 38 nodes, `core.js`) and its tests. Synthetic data, DEWA published tariff (simplified, updated 2026-11-20), simulated device. It replaces the EcoWatch note (`../ARCHITECTURE_NOTE.md`), which described the earlier placeholder build.*

## 30-second spoken version

"EcoShield watches a school's meter data. It catches water leaks, forecasts the bill using the price slabs, and handles requests to change the air-conditioning or shut the main water valve. The rule we built around is this: the AI talks, the code decides, a human approves. The AI only picks the order of the tools, writes the explanation, and, if the code blocks something, suggests a safer setpoint that the code checks again. Every limit, every number and every write is plain code. Setpoint changes and valve shutoffs wait for a named person. Occupancy data never leaves the laptop. If every AI is down, the safety logic still works."

## Goal

Cut water and cooling waste in a school or home without ever making it unsafe. Detect leaks early, show what they cost, and let automations request changes, but only inside hard limits and, for risky actions, only with a person's approval.

## The pipeline, stage by stage

| # | Stage | Done by | What happens | n8n nodes |
|---|---|---|---|---|
| 1 | Trigger | Person | Console form: pick one of 14 scenarios (or UNDO / RESET), optional note. A dashboard page shows history and replays past cases. | Console form, Dashboard hook |
| 2 | **Validate** | Plain code | The note is scanned for injection tricks before any tool or AI sees it. The meter feed is checked: format, impossible values, duplicates, freshness, and agreement between two meters. Bad input stops here. | Validate input, Input accepted?; `read_meter_data` inside Run tool |
| 3 | **Plan** | AI picks order, code enforces | The AI chooses the next tool, but only from a list the code builds. A wrong pick or an early "finish" is overridden. After 2 bad picks, or if every planner is down, a fixed order is used. Hard cap 8 steps. | Plan state, Ask planner LLM?, Groq plan / Groq 20B plan / Ollama plan, Parse plan, Finished? |
| 4 | **Act (loop)** | Plain code | Four allow-listed tools: `read_meter_data`, `run_leak_and_bill_forecaster`, `lookup_case_history`, `check_safety_guard`. Code builds the arguments. The loop repeats until the guard has produced the proposed action. | Run tool |
| 5 | **Remember** | Plain code | Per-scenario device state, last 30 cases, decisions and the undo stack, kept between runs and restarts. Repeats are recognised (no duplicate alert), and earlier decisions are shown to the approver. | Save memory |
| 6 | **Guard** | Plain code only | `heatGuard`: occupied setpoint over 24 °C blocked; unoccupied pre-cool over 27 °C blocked; cooling switched off in heat blocked; sending occupancy out blocked; untrusted data fails closed; a request that changes nothing is "no change". First rule that fires wins and is named. | Run tool (`check_safety_guard`) |
| 6b | **Replan** | AI proposes, code decides | For a fixable block, the AI proposes one safer setpoint or none; the guard re-checks it. At most 2 tries, then a named person reviews. Privacy, injection and untrusted-data blocks are never replanned. The AI is given no limit values and no rule names. | Replan check, Replan needed?, Groq / 20B / Ollama replan, Parse replan |
| 7a | **Safe path** | Plain code | A leak or watch alert is raised automatically through the write gateway (logged, undoable). | Auto actions |
| 7b | **Human path** | Person | Setpoint changes, valve shutoffs and rollbacks pause at a form: Approve or Reject plus a reviewer name. A blank name counts as not approved. After the replan cap, a review form records Acknowledge or Escalate. | Needs approval?, Approval form, Needs review?, Review form, Record review |
| 8 | **One write gateway** | Plain code | The only function that changes state. It re-checks every limit, takes a snapshot first, and rolls back on any failure. It changes a simulated device record, not hardware. | Approve and write / No write |
| 9 | **Explain, log, report** | AI writes text only; code logs | The AI writes the plain-English explanation from numbers it was handed (text quoting any other number is discarded). Every input, tool call, AI call, decision and approver is written to `ecoshield_audit.jsonl`. | Build LLM prompt, Groq / 20B / Ollama explain, Parse LLM, Build page, Write audit log |
| 10 | **Demo and replay** | Code + person | Per-run result page (shows what code decided vs what the AI did, and exactly what left the laptop), a dashboard, and replay of any past case from the log with no tools and no AI re-run. | Show result, Dashboard page, Respond HTML |

## What the AI does and does not do

| The AI does | Code does (the AI never does) |
|---|---|
| Chooses the order of tools, inside a code-built list | Leak verdict and slab bill maths |
| Writes the explanation from numbers it is handed | Every limit, every block, every rule name |
| After a block, proposes one safer setpoint (or none) | Re-checks that proposal, approval, and the write |
| | Privacy filter, injection scan, data validation, memory, logging, rollback |

The AI can make the system more cautious or leave it unchanged; it cannot loosen a limit, approve anything, or write anything.

## How the key requirements are met

- **Leak detector:** water use at night (01:00-05:00) of at least 10 L/h on 2 nights, or a continuous 24-hour run, is a LEAK; 3 L/h or more is a WATCH; too many missing hours gives INSUFFICIENT_DATA instead of a guess. If the occupancy flag says people are present, night use is not a leak.
- **Bill forecaster:** month so far plus the average of the last 14 full days times the remaining days, priced slab by slab (electricity with a fuel surcharge, water), with and without the leak so the leak's cost in AED is visible. A naive projection, not a prediction.
- **Occupancy privacy:** one allow-list function builds every outbound AI payload and an assertion re-checks it. The result page lists what was sent. A request to export occupancy is blocked (scenario 10). n8n runs on the laptop, not in the cloud.
- **Heat-safety guard:** hard limits in one object (`LIMITS`) and one function (`heatGuard`). The write gateway checks them a second time.
- **Human approval:** required for setpoint changes, main-valve shutoff and rollbacks. Forecasts are automatic. Whether a leak alert is automatic depends on the **evidence score**: HIGH (85 and up) raises it by itself, MEDIUM (50-84) holds it until a named person approves, LOW (under 50) raises nothing and watches. Code decides this; the AI never sees the score.
- **Evidence strength and adaptive autonomy:** `evidenceStrength` scores each leak verdict 0-100 (missing night readings, impossible readings, meter disagreement, stale feed, short history, weak signal) and lists every deduction on the result page. `autonomyFor` maps the score to what the agent may do alone. No score fails closed to watch only.

## Defence in layers

1. **Before any AI:** input validation and the injection scan; the feed checks. Bad or hostile input never reaches a tool or model.
2. **While the AI is working:** it can only pick from a code-built tool list; arguments are built by code; every reply is parsed and checked; a proposed setpoint goes through the same guard as any request; AI text with an invented number is discarded.
3. **Whatever the AI says:** approval is a separate form with a named person, the write goes through one gateway that re-checks limits and can roll back, and text can neither approve nor call a tool. This is the layer that matters most, because pattern lists alone are not a complete defence.

## Failure handling (what actually happens)

- **A cloud model is rate-limited or down:** chain is Groq gpt-oss-120b, then Groq gpt-oss-20b (its own limit), then local Ollama (qwen3:1.7b), then a plain-code template for the explanation. Each AI step (plan, replan, explain) has the chain.
- **Every AI is down:** the planner uses a fixed order, the guard and maths are unaffected, the explanation is a template. Safety does not depend on the AI.
- **The AI returns nonsense or something hostile:** the parse or the allow-list overrides it; two bad planner picks switch to the fixed order; a failed replan counts as an attempt, and after 2 a person decides.
- **Bad data:** a few impossible readings (HS-5.3) are set aside, logged and kept out of the leak check and the bill; corrupt, stale or disagreeing feeds stop the run as "untrusted data" and nothing is judged.
- **A room sensor goes offline (HS-5.5):** that room is assumed occupied and hot, so it is held at the 24 C ceiling and never raised; other empty rooms can be proposed up to 27 C, still with a person approving. A missing outdoor temperature counts as hot.
- **The privacy filter fails (HS-5.2):** the explanation step sends the plain-code template and makes no cloud call.
- **A write fails:** the gateway rolls back to the snapshot.
- **A mistaken approval:** Undo restores the previous state.

## How it was tested

- `tests/test_core.js`: **176** unit checks, including limits and boundaries (27.0 allowed, 27.1 blocked).
- `tests/sim_workflow.js`: **202** checks running the real generated graph in a mini engine with stubbed AI, including garbage, failing and hostile AI replies, replan paths, undo, replay and persistence.
- `tests/live_run.js`: **83** checks on the live local n8n with real Groq, and **72** with Groq switched off so Ollama alone did everything. This found and fixed a real bug: Ollama was unreachable at `localhost` (IPv6); the URL is now `127.0.0.1`.
- **Quota test:** 42 back-to-back runs (14 scenarios x 3 rounds) hit no rate-limit errors. That proves one moment on one free key, not a guarantee; repeat it on the day.
- **What this does not show:** our thresholds and scenarios are ours and the data is synthetic, so passing them is not a claim of real-world detection accuracy.

## Design principles

1. Plain code decides; the AI assists.
2. Safe by default: when unsure, stop and ask a person.
3. Every stage is logged, and a past case can be replayed without re-running anything.
4. Every loop is capped and every outside call has a timeout.
5. Limits, thresholds, tariff and scenarios each live in one place (`core.js`), so a live change in Round 2 is a small edit.

## Known limits (say these before a judge finds them)

- The **tariff** follows DEWA's published slab tariff page (checked 2026-11-20): electricity slabs, fuel surcharges and 5% VAT. Simplified: no fixed meter service charge, and we assumed the commercial water slabs for a school.
- The **38 °C heat limit** for "no cooling-off" is our guess; the statement gives 24 °C and 27 °C as examples ("e.g.") and we have not had them confirmed.
- **Leak thresholds** (10 L/h, 2 nights or a 24-hour run, 01:00-05:00) are our choices, tuned on our own synthetic data.
- The **device is simulated**; the gateway changes a record, not hardware.
- **Memory** is n8n static data, not a database. Two approvals paused at the same time could overwrite each other's memory (untested): do one at a time.
- The **reviewer name is typed, not authenticated.**
- The **audit log stays local and does contain occupancy**; only the sanitised payload goes to the cloud.
- **Round 3:** the approval timeout with a safe default IS now built (wait limit on both approval forms), as are CSV upload, the failure drill and token logging.
- **Not built:** a conflict check (the burst test showed simultaneous runs lose memory updates) between simultaneous requests (see above), Cerebras/Gemini fallback links, tracing, multi-agent, the optional stretch features (irrigation, leaderboard, pre-cooling scheduler).
- The local model (1.7b) is weak; the manual suggests a 4b model, which did not fit in free RAM with Chrome open.
- The pre-build history is stated in `CHECKPOINTS.md`: the first plan was for a Python build; the n8n plan was written after the build.
