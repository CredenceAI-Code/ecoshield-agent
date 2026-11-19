# PLAN.md: EcoShield (TechX Dubai'26, Domain 5, High School Track): the plan as BUILT

**Read this first (history, stated plainly).** A first PLAN.md was written on 2026-11-19 *before any code*. It described a Python + SQLite + Streamlit build. It is kept unchanged as [`PLAN_v0_python_design_2026-11-19.md`](PLAN_v0_python_design_2026-11-19.md). The build then moved to **local n8n** (the manual's no-code path, and the one the team will use on the day), so v0 no longer described what exists. **This file was rewritten AFTER the build, on 2026-11-19, to match what was actually built and tested.** It is a specification of the finished system, not a plan that was followed in order. The five sections below follow the manual's master-prompt structure (p28).

Source documents: the emailed problem statement (`../STATEMENT_ANALYSIS.md`) and `TechX_Agentic_AI_Manual.pdf` (checked item by item in `../MANUAL_CHECKLIST.md`).

## 0. Ground rules (apply to anyone, human or coding agent, who changes this)

1. **Code decides, the AI talks.** Leak verdicts, bills, limits, approvals, writes and "what may run next" are plain code (`core.js`). The AI orders tools, proposes a replacement setpoint, and writes the explanation. Every AI output is validated; a wrong or invented one is overridden or discarded.
2. **Occupancy never leaves the laptop.** One function (`sanitize`, an allow-list) builds every outbound AI payload; an assertion re-checks the text. The only AI that could see more would be local, and none is given more.
3. **Hard limits live in one object (`LIMITS`) and one function (`heatGuard`).** No AI output can change them. The write gateway re-checks them again.
4. **One write function (`writeGateway`)**: snapshot first, all-or-nothing, rollback on failure, undoable.
5. **Every AI loop is capped:** planner `MAX_STEPS = 8` and `MAX_INVALID_PICKS = 2`; replanner `MAX_REPLANS = 2`; every HTTP call has a timeout and at most 2 tries.
6. Synthetic data only. Free tiers only. Never spend money. Keys live in n8n Credentials, never in files.

## 1. System architecture and stack

**Stack:** n8n 2.48.6 self-hosted (`npx n8n`), Node 24 for tests, JavaScript Code nodes (all logic in `core.js`, pasted into nodes by a generator), Groq `openai/gpt-oss-120b` (free tier, via n8n Credential "Groq key") as the main model, Groq `openai/gpt-oss-20b` (own rate limit; the manual's llama-3.1-8b-instant is not available on this key) as the second link, **Ollama `qwen3:1.7b`** (local, no key; the manual's tier for under 8 GB RAM) as the fallback, and a plain-code template as the last resort. No database server: memory is n8n workflow static data; audit log is a JSONL file.

**Data flow (the manual's ten stages):**

```
1 Trigger       Console form (12 scenarios + UNDO + RESET + optional note)       [Dashboard webhook: view + replay]
2 Validate      Validate input (note: injection checks) -> read_meter_data (schema/range/duplicate/freshness)
3 Plan  <-+     Plan state -> Groq plan | Ollama plan -> Parse plan  (AI picks tool ORDER from a code-built allow-list)
4 Act   --+     Run tool: read_meter_data | run_leak_and_bill_forecaster | lookup_case_history | check_safety_guard
5 Remember      Save memory (static data): device state, last 30 cases, decisions, undo stack
6 Guard (code)  heatGuard: privacy export, untrusted data, 24/27 C ceilings, no cooling-off in heat, already-in-state
6b Replan       Replan check -> Groq replan | Ollama replan -> Parse replan -> back to Replan check (max 2), else person
7a Safe auto    Auto actions: leak alert raised through the gateway (logged, undoable)
7b Human        Approval form (named reviewer, optional note) | Review form (after the replan cap)
8 One gateway   Approve and write -> writeGateway (re-check, snapshot, rollback)
9 Log + report  Build page -> Write audit log (JSONL, every input/tool/decision/approver/AI call/replan)
10 Demo         Per-run page + dashboard + replay a past case from the log with no tools and no AI
```

## 2. File by file

| File | Purpose |
|---|---|
| `core.js` | ALL decision logic, plain code, no network: scenarios, synthetic data generator, leak detector, slab bill forecaster, note and feed validators, privacy `sanitize`, `heatGuard`, `applyReview`, `writeGateway`, planner allow-list (`runnable`, `deterministicNext`, `planView`), replan loop (`needsReplan`, `replanView`, `parseReplan`, `applyReplan`, `recordReview`), memory helpers. Run by tests in Node; pasted verbatim into n8n Code nodes. |
| `page_js.js` | HTML builders for the result page and dashboard (`outcome`, `renderPage`, `renderDashboard`). |
| `make_ecoshield_workflow.py` | Generates `ecoshield_workflow.json` (37 nodes, deterministic ids so the form URL never changes). `ECO_OLLAMA_ONLY=1` writes `tests/ollama_only_workflow.json` with Groq pointed at a dead port. |
| `ecoshield_workflow.json`, `EcoShield_Agent_export_*_v*.json` | The importable workflow and dated copies. |
| `export_csv.js`, `data/` | Synthetic dataset for judges: `smart_resource_meters.csv` (hourly rows, 14 scenarios), `scenarios.csv` (with expected verdict and guard rule per scenario), `sample_audit_excerpt.jsonl`. |
| `tests/test_core.js` | Unit tests of every function in `core.js`, including thresholds and boundaries. |
| `tests/sim_workflow.js`, `tests/engine.js` | The REAL generated graph run in a mini engine with stubbed AI, including garbage, failing and hostile AI replies, replan paths, undo, replay, persistence. |
| `tests/live_run.js`, `tests/live_persist.js` | Drive the live local n8n (real Groq, real memory, real forms). |
| `README.md` | How to run, stage table, honest caveats. |

## 3. Build order as it actually happened (and what is Must-Have vs stretch)

**Must-have (MVP):** 1. synthetic data + leak detector + slab bill (tested by hand-computed slabs). 2. `heatGuard` + privacy `sanitize` + `writeGateway`. 3. n8n graph: form, validate, tool loop, guard, approval, gateway, audit file. 4. AI explanation with Ollama and template fallbacks. 5. Result page for the demo.
**Stretch (all built):** AI planner loop with code override; memory, undo, reset; dashboard + replay; injection scenario and corrupt-feed scenario; **replan loop capped at 2 then a person**; second review form.
**Also built later the same day:** scenarios 13 (setpoint exactly on the limit) and 14 (two meters disagree), second Groq model link, optional approver note, Git repo.
**Not built:** multi-agent (the manual says start simple), approval timeout default, conflict check, Langfuse, Cerebras/Gemini links.

## 4. Human-in-the-loop checkpoints (what a person decides)

Runtime (in the product): **(a)** every setpoint change, valve shutoff and rollback needs a named approver; **(b)** after the replan cap, a named person reviews the AI's failed attempts and records Acknowledge or Escalate (a review can never unblock a hard limit).
Build time (what was actually done, no more): the builder (Akash) chose the track and domain, chose the n8n path, read the stage-by-stage coverage answers, decided what to build next after each, and ran/approved the results in chat. There was **no formal per-phase checkpoint log**, and no claim of one is made. Still his alone: confirm the tariff, the 38 C limit and the organisers' open questions (section 6).

## 5. Rebuild prompts (for a coding agent; attach this file first)

1. *Read PLAN.md and core.js. Do not change core.js behaviour. Re-run `node tests/test_core.js` and `node tests/sim_workflow.js`; report the counts.*
2. *Run `python make_ecoshield_workflow.py`, import with `npx n8n import:workflow --input=ecoshield_workflow.json`, publish with `publish:workflow --id=va1J6ZZ2bCfcd2mT`, then `node tests/live_run.js`.*
3. *Fix prompt: This behaviour is wrong: <paste>. Fix only that, change `core.js` first, regenerate, rerun all three test files, show the diff.*

## 6. Assumptions and open questions (not facts)

1. **Tariff** is from secondary web guides, not DEWA (`TARIFF.verified = false` on every page). A school may pay a commercial rate.
2. **38 C** (no cooling-off while occupied) is my guess. The statement gives 24 C and 27 C as "e.g.".
3. Leak thresholds (10 L/h, 2 flagged nights or a 24 h run, 01:00-05:00) are mine, tuned on my own synthetic data, so passing all scenarios is not an accuracy claim.
4. The device is a **simulated record**, not hardware.
5. Memory is n8n static data (survives restarts, verified), not SQLite; two runs paused at an approval at the same time could overwrite each other's memory (untested).
6. Organisers still to answer: may pre-built workflows be used on the day; what is submitted at 12:30; which n8n version and whether Ollama is pre-installed; exact heat limits and tariff for this domain.

## 7. Manual alignment

See `../MANUAL_CHECKLIST.md` for the item-by-item table against all 33 pages. Replan loop: manual p16-17 and p33. Ollama-only end-to-end run: p33 item 1 (result recorded in README).
