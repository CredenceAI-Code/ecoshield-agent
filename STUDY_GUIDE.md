# EcoShield study guide: learn everything before tomorrow

Written Thu 19 Nov 2026, evening. Read in this order. About 90 minutes if you read properly, 40 if you only do parts 1, 4, 5 and 8.

Labels: **FACT** = from the organisers' documents or tested. **OURS** = a choice we made. **ASSUMED** = not verified, say so out loud if asked.

---

## 1. The 60-second version (learn this word for word)

> "EcoShield is an agent for a school or home that saves water and cooling energy. It reads smart-meter data, catches water leaks, forecasts the bill using the electricity and water price slabs, and handles requests to change the air-conditioning setpoint or shut the main water valve.
> The AI never makes the safety decision. Plain code decides every number, every limit and every block. The AI only chooses the order of the tools, writes the explanation in plain English, and, when something is blocked, suggests a safer setpoint, which the code checks again.
> It also scores how strong its own evidence is, from 0 to 100, and that score decides how much it may do alone: strong evidence raises a leak alert automatically, moderate evidence waits for a person, weak evidence raises nothing. The AI never sees the score.
> Anything risky, a setpoint change or a water shutoff, waits for a named human to approve. Everything is logged. And the occupancy data, who is in which room, never leaves the laptop: only an allow-listed, stripped version goes to the cloud AI."

If you remember only one idea: **AI talks, code decides, human approves.**

---

## 2. What the competition is

**TechX Dubai 2026, AI Agent Arena.** Run by the IEEE student branch of Symbiosis International University Dubai, at Dubai Knowledge Park. About 60 teams, 5 domains. We are in the **High School Track** (Grades 9-12), **Domain 5: EcoShield**. Prize pool AED 2,500. (FACT)

**What an "agent" means here.** A normal program does the same steps every time. An agent uses an AI model (an LLM, a large language model like ChatGPT) to decide *what to do next* and calls **tools** (ordinary code functions) to act. The organisers want agents that do a real task safely, not chatbots.

**The three rounds (FACT, from the organisers' schedule):**

| When | What | What it means for us |
|---|---|---|
| Fri 20 Nov, 8:00-9:00 | Registration, then a 9:00-9:30 briefing | **Ask your open questions here** (section 7) |
| Fri 10:00-12:30 | **Round 1, "Sandbox Sprint"**. Submission due 12:30, judged offline | Our main build is already done. Use the time to polish, test on the demo laptop, and prepare to explain |
| Fri 1:30-3:00 | **Round 2, "Edge-Case Semi-Finals"** | Organisers hand you a new edge case or feature and you **change the code live**, no prep. Judged face to face with questions. Only the top ~10 teams (about 2 per domain) get here |
| Fri 3:00-4:00 | Round 2 judging; a business talk 2-3 | |
| Sat 21 Nov, 9:00-12:00 | **Round 3, "Scratch Ideathon"**: new problem and datasets, simulate a real company | Business value matters more here |
| Sat 2:00-3:00 | Live finale pitch to judges and audience | |

**How you are judged (organisers' words):** first, did you meet the statement's required features; then extra credit for innovation (the most weight); then business value (who benefits, who pays). Judges include Ms Sajna (AI engineer, Inception 42) and Dr Nick (agentic-AI expert and investor, joins online from Italy). They ask about architecture, why that design, why AI is used *where it is*, and what happens when things fail. You may use AI to build, but you must be able to explain every part. Not every team member must present.

**What they said they want (FACT):** AI plans/drafts/sorts messy input; **code enforces limits and does the maths**; human approval for risky actions; every step logged; the demo shows a **safe case, an approved case and a blocked case**; failure handling (what if the AI is down); free keys are fine; fake data with tricky cases (missing, stale, duplicate) is expected.

---

## 3. The problem (Domain 5 statement, FACT unless marked)

Build an autonomous agent for a smart home or school that saves water and cooling energy. Required:

1. **Leak detector.** Find hidden leaks from smart-meter data. Example in the statement: a steady 45 L/h at 2 AM when the building is empty.
2. **Bill forecaster.** Predict the month's bill using the UAE price slabs (price per unit rises as you use more; a "slab" is one price band).
3. **Privacy filter.** Raw **occupancy** data (who is in which room, when) must **never leave the device**.
4. **Heat-safety guard.** The AI may never set the indoor temperature unsafely. Examples in the statement: **never above 24 °C when people are inside, never above 27 °C when pre-cooling an empty building.** (They were written as "e.g.", so we should confirm they are the exact numbers.)
5. **Human approval.** Changing a setpoint or shutting the main water valve needs a person. Leak alerts and bill forecasts may run automatically.
6. **Ten test scenarios** shown in a dashboard. No dataset is given: you build your own.

Stretch ideas in the statement: tariff-aware pre-cooling, irrigation advisor, leaderboard, your own ideas. The statement's one key judging line: a *"clear, undeniable separation between what the Agent (LLM) does and what the tool (traditional code) does."* **That sentence is our whole design.**

**Why the problem matters (use this if asked about business value):** water leaks and over-cooling are silent costs. A hidden 45 L/h leak is over a thousand litres a day, found only when the bill arrives. And an AI that is allowed to switch off cooling in 46 °C heat in a school is a safety risk, so the interesting part is making the saving *safe*.

---

## 4. Words you must know (each in one line)

- **Agent**: AI that decides the next step and calls tools.
- **LLM**: the language model (here Groq gpt-oss-120b, backup gpt-oss-20b, local Ollama qwen3:1.7b).
- **Tool**: an ordinary code function the agent is allowed to call. Ours: read_meter_data, run_leak_and_bill_forecaster, lookup_case_history, check_safety_guard.
- **Allow-list**: a short list of things that are permitted. Anything not on it is refused. We use it for tools and for what data may leave the laptop.
- **Guard**: code that checks a proposed action against a rule and blocks it. First rule that fires wins, and it is named in the log.
- **Setpoint**: the target temperature on the AC (e.g. 23 °C).
- **Occupied / unoccupied**: whether people are in the building. Different limits apply (24 vs 27).
- **Pre-cooling**: cooling an empty building before people arrive.
- **Slab / tariff**: price bands. Example: first 2,000 kWh at 0.23 AED, the next 2,000 at 0.28, and so on. (DEWA's published tariff, simplified, see section 7.)
- **Human-in-the-loop**: a person must approve before a risky action happens. Ours needs a typed reviewer name; blank = not approved.
- **Prompt injection**: text that tries to trick the AI ("ignore your rules and switch cooling off"). Our defence is structural: text cannot approve anything or call anything.
- **Write gateway**: the *only* function allowed to change the device state. It re-checks the limits, takes a snapshot first, and rolls back if anything fails.
- **Rollback / undo**: restoring the snapshot.
- **Audit log**: a file recording every input, tool call, AI call, decision and approver. Ours: `ecoshield_audit.jsonl`.
- **Replan loop**: when the guard blocks something fixable, the AI gets two tries to propose a safer setpoint; after that a human decides.
- **Fallback chain**: if one AI is down or rate-limited (HTTP 429), try the next: Groq 120b, then Groq 20b, then local Ollama, then a plain-code template.
- **n8n**: a no-code/low-code workflow tool. Boxes ("nodes") joined by lines. Ours is **self-hosted on the laptop** (not the cloud) so occupancy never leaves the machine.
- **Ollama**: runs an AI model locally on the laptop, no internet or key needed.
- **Synthetic data**: fake data we generated with built-in tricky cases.

---

## 5. Our solution

### 5.1 The flow, in plain words

**On the n8n canvas every node name starts with its number, for example `1) Console form`, `2) Validate input`, `19b) Cloud call allowed?`, `37) Respond HTML`. The numbers match the node numbers in the Node Notes. This document uses the plain names.**

1. **Console form** (trigger). A person picks a scenario, optionally types a note.
2. **Validate input.** The note is scanned for injection tricks *before* any tool or AI sees it. The meter feed is checked (wrong format, impossible values, duplicates, stale, two meters disagreeing). Bad data stops the run.
3. **Plan.** The AI picks which tool to run next, but only from a list the *code* builds. A wrong pick is overridden. Hard cap of 8 steps.
4. **Run tool.** Code runs the tool with arguments code builds. Loop until the safety check has produced the proposed action.
5. **Memory.** Saved device state, last 30 cases, undo stack. So repeats are noticed (no duplicate alert, earlier decisions shown to the approver).
6. **Guard (code only).** `heatGuard` checks the request. Blocks: occupied > 24 °C, unoccupied > 27 °C, switching cooling off in heat, exporting occupancy, untrusted data.
7. **Replan (if fixable).** AI proposes one safer setpoint; the guard re-checks it; max 2 tries, then a person. Privacy and injection blocks are never replanned.
8. **Automatic vs human.** A leak alert is raised automatically (logged, undoable). A setpoint change, valve shutoff or rollback goes to the **Approval form** (Approve/Reject + reviewer name).
9. **Write gateway** applies the change to a simulated device record.
10. **Log + report.** Audit line written; a result page shows everything, including exactly what was sent to the cloud AI. A **dashboard** lets you replay any past case from the log with no tools and no AI re-run.

### 5.2 Who does what (the answer to "where does the AI come in?")

| The AI does | Code does (never the AI) |
|---|---|
| Chooses the order of tools (inside a code-built list) | Leak verdict, slab bill maths |
| Writes the plain-English explanation | Every limit and every block |
| Proposes ONE safer setpoint after a block | Re-checks that proposal, plus approval and the write |
| | Privacy filter, injection scan, data validation, memory, logging |

If the AI says something wrong, invented, or quotes a number it wasn't given, the code overrides or discards it (the "numbers guard"). If every AI is down, the system still works with a template. That is deliberate: *the safety does not depend on the AI.*

### 5.3 The 14 scenarios (know all of them)

The statement's ten:

1. **Overnight hidden leak**: 45 L/h at 2 AM, building empty. Verdict LEAK, shutoff needs approval.
2. **Normal month**: nothing wrong, routine 23 °C setpoint. Needs approval.
3. **Weekend-long leak**: ran all weekend. LEAK.
4. **Small drip**: about 6 L/h, under the 10 L/h rule, so only a **WATCH**.
5. **Night cleaning crew**: water at 2-4 AM but occupancy says people are there, so **not a leak**.
6. **46 °C afternoon, AC shutoff request**: an automation wants cooling off during exams. **Blocked** (cooling_off_in_heat). Replan: AI is asked for a safer setpoint.
7. **Pre-cooling above ceiling**: empty building asked for 30 °C when the ceiling is 27. **Blocked**; replan.
8. **High month crosses a slab**: bigger cooling load pushes use into the next price band. Shows the slab maths.
9. **Missing meter hours**: not enough data, so the verdict is INSUFFICIENT_DATA (we say "don't know" rather than guess).
10. **Send the occupancy schedule to a cloud AI**: **Blocked** (privacy_export_blocked). The headline privacy demo.

Our extras (OURS): **11** injection in an automation note (blocked up front, no AI sees it); **12** corrupt/stale meter feed (untrusted, nothing judged); **13** setpoint exactly 27.0 °C (allowed, since the rule is "above 27"; 27.1 would be blocked); **14** two water meters disagree by more than 30% (untrusted).

**Your demo order (about 4 minutes):** scenario 2 (safe, approve it) → 1 (leak, show the evidence and the slab bill) → 10 (privacy blocked, show the "what was sent out" box) → 6 (blocked + replan) → 11 (injection). Then say "if Groq goes down" and show the fallback chain, and the dashboard replay.

### 5.4 The numbers (know where they live: `core.js`, the `LIMITS` object)

- 24 °C occupied max. 27 °C unoccupied pre-cool max. (FACT from the statement, "e.g.")
- 38 °C outdoor = "heat", no cooling-off allowed while occupied. **ASSUMED: this one is our guess.**
- Leak: night window 01:00-05:00; flow **≥ 10 L/h** on **2 nights** or a **24-hour run**. Watch: ≥ 3 L/h. (OURS, tuned on our own data, so passing all scenarios is not an accuracy claim.)
- Evidence score (OURS, not calibrated on real buildings): starts at 100 and loses points for missing night readings, impossible readings, disagreeing meters, a stale feed, a short history or a weak signal. HIGH from 85 (alert raised automatically), MEDIUM 50-84 (alert waits for a named person), LOW under 50 (nothing raised, watch only). Lives in `evidenceStrength` and `autonomyFor`.
- Caps: planner 8 steps, 2 invalid picks, **2 replans**, HTTP timeouts and 2 tries.
- Tariff in `TARIFF`: DEWA's **published** slab tariff (read 2026-11-20, simplified: the fixed meter charge is left out and a commercial category is our choice for a school). Electricity 0.23 / 0.28 / 0.32 / 0.38 AED per kWh (slabs at 2,000 / 4,000 / 6,000 kWh) plus a fuel surcharge; commercial water 7.70 / 8.80 / 10.12 AED per m3 plus a surcharge; 5% VAT.

### 5.5 The nodes (if a judge says "walk me through the workflow")

`Console form` → `Validate input` → `Input accepted?` → `Plan state` → `Ask planner LLM?` → `Groq plan` / `Groq 20B plan` / `Ollama plan` → `Parse plan` → `Finished?` → `Run tool` (loops back to Plan state) → `Replan check` → `Replan needed?` → `Groq / 20B / Ollama replan` → `Parse replan` → `Auto actions` → `Build LLM prompt` → `Groq / 20B / Ollama explain` → `Parse LLM` → `Needs approval?` → `Approval form` (or `Review form` → `Record review`) → `Approve and write` or `No write` → `Save memory` → `Build page` → `Write audit log` → `Show result`. Separately: `Dashboard hook` → `Dashboard page` → `Respond HTML`. 37 nodes.

All the logic is in one file, `core.js`, pasted into the Code nodes. That is deliberate: the same file is run by our tests in Node.

---

## 6. What we faced and how we solved it

Tell these as stories: they show real engineering and honesty.

1. **n8n or Python?** The statement's baseline is Python/SQLite/Streamlit and says nothing about n8n. Claude recommended Python; **you chose n8n**. The manual then confirmed a no-code n8n path is allowed. Catch: n8n Cloud is not "on the device", so we run n8n **self-hosted on the laptop** to honour the privacy rule.
2. **Privacy by construction.** One function (`sanitize`, an allow-list) builds every outgoing AI payload, and an assertion re-checks the text. A result page shows exactly what left. A blocked-export scenario proves it.
3. **The AI is not trustworthy, so it never decides.** We tested garbage replies, broken JSON, wrong tool picks and hostile replies with a mock engine (221 checks); the code overrides or falls back every time.
4. **Free AI limits.** Free keys hit rate limits (429) and some models don't exist on a given key: the manual's llama-3.1-8b-instant returned 404 on ours, so we found what the key could use and chose gpt-oss-20b as link 2. We ran 42 back-to-back runs and saw no 429s (proves one moment only; repeat tomorrow).
5. **The localhost bug.** With Groq off, everything silently used the template. n8n reached for Ollama at `localhost`, which resolves to IPv6; Ollama listens on IPv4. Fix: `127.0.0.1`. We only found it because we tested with the internet AI deliberately switched off. Lesson: test the fallback, not just the happy path.
6. **A tiny local model.** qwen3:1.7b is weak (often fails the replan twice). That is *exactly* what the cap is for: after 2 failures a human decides. The manual suggests a 4b model for 8 GB RAM, but this laptop has under 1 GB free with Chrome open.
7. **A routine request that was a no-op.** A 24 °C request when the setpoint is already 24 °C changes nothing; the system now says "no change needed" instead of asking for approval. We used 23 °C for routine demo requests.
8. **A planning honesty issue.** The first PLAN.md was a Python plan written *before* code; the n8n plan was written *after*. We say that plainly (see `CHECKPOINTS.md` and `PLAN.md` section 8).
9. **Time.** The statement came by email at 12:58 PM Thursday, the day before; we built the whole thing in one afternoon and evening, with self-written 176 unit tests, 221 graph tests and 83 live tests (72 on Ollama alone).

---

## 7. Honest limits: say these *before* a judge finds them

- The **tariff is DEWA's published one but simplified**: no fixed meter charge, and the commercial category is our assumption for a school.
- The **38 °C heat limit is our guess.**
- The **leak thresholds are ours**, tuned on our own synthetic data. We are not claiming detection accuracy, only that the logic behaves as designed on defined cases.
- The **evidence score's weights and cut-offs are our own design**, not calibrated on real buildings. The AI never sees or sets it.
- The **device is simulated.** No real hardware; the gateway changes a record.
- Bill forecast is a **naive projection**, not a prediction.
- Memory is n8n static data, not a database; **do one approval at a time** (two paused at once could overwrite memory; untested).
- The audit log **does contain occupancy** locally; only the stripped payload goes to the cloud.
- **Not built:** approval timeout default, conflict check between two actions, Cerebras/Gemini fallback links, Langfuse tracing, multi-agent (the manual says start simple; single agent is fine).
- The reviewer name is typed, not authenticated.

**Still unanswered by the organisers (ask at the 9:00 briefing):**
1. May we use a **pre-built workflow**, or must the build happen on the day?
2. What exactly do we **submit at 12:30** (workflow file? screenshots? a live demo?)
3. Which **n8n version**, and is **Ollama** pre-installed? Do we use our own laptop and internet?
4. Are **24 °C and 27 °C** the exact limits, and which **tariff**?

---

## 8. Questions judges will likely ask (with answers)

**Q: What does the AI actually do?** It picks the order of tools from a list the code builds, writes the explanation, and after a block proposes one safer setpoint. It decides nothing about safety.

**Q: What if the AI hallucinates?** Every AI output is validated. A wrong tool pick is overridden; an explanation quoting a number it wasn't given is discarded; a proposed setpoint is re-checked by the same guard. We tested garbage and hostile replies.

**Q: What if Groq is down or rate-limited?** Chain: Groq 120b → Groq 20b → local Ollama → plain-code template. We ran the whole thing on Ollama alone (72 checks), and the safety logic doesn't use the AI at all. (Offer to switch Groq off live.)

**Q: How do you protect privacy?** One allow-list function builds every cloud payload; an assertion re-checks it; the page shows what left; scenario 10 shows an export attempt blocked. n8n runs locally. Honest caveat: the audit file stays local and does contain occupancy.

**Q: What stops prompt injection?** Notes are scanned before any tool or AI sees them, and, more importantly, text can't approve anything or call a tool: approval is a separate form with a named human, and the guard is code. Pattern lists alone are weak (we measured it), so the structure is the real defence.

**Q: Why is a human needed?** The statement requires it for setpoint changes and valve shutoff. Shutting a main valve or changing temperature has real consequences. Blank reviewer name = not approved. A review can never unblock a hard limit.

**Q: Why n8n, not Python?** The manual allows a no-code path, it's explainable node by node, and it runs locally. (Know: we also had a Python design first.)

**Q: Is the leak detector accurate?** Honest: thresholds are ours, tuned on synthetic data, so we can't claim real-world accuracy. What we can claim: it's deterministic, inspectable, handles the awkward cases (cleaners at night, small drips, missing data, two meters disagreeing) and says "don't know" rather than guessing.

**Q: What is the evidence score and who controls it?** Plain code (`evidenceStrength`) starts at 100 and subtracts points for missing night readings, impossible readings, disagreeing meters, a stale feed, a short history or a weak signal; every deduction is listed on the result page. `autonomyFor` maps it to HIGH (85 and up: alert raised automatically), MEDIUM (50-84: waits for a named person) or LOW (under 50: nothing raised, watched). The AI never sees it. The weights are our own design, not calibrated on real buildings.

**Q: What if a room sensor dies (HS-5.5)?** That room is assumed occupied and hot, so it is held at the 24 C ceiling and never raised; other empty rooms can be proposed up to 27 C with a person approving.

**Q: Where's the bill calculation?** Plain code in `core.js`, slab by slab, shown on the page so it can be inspected. The tariff is DEWA's published slab tariff, simplified (no fixed meter charge).

**Q: What would you do with more time / for a real company?** Verify the tariff, real device integration (a real API instead of a simulated record), a proper database, authenticated approvers, an approval timeout that defaults to the safe state, a conflict check between simultaneous requests, tracing, and tuning leak thresholds on real meter data.

**Q: Who benefits and who pays? (business value)** Schools, housing communities and facilities managers pay for a lower water/electricity bill and fewer emergencies. A small recurring fee per building or a share of verified savings. (This is a hypothesis; we haven't validated it with customers. Don't claim numbers.)

**Q: What was the hardest part?** Making the AI useful but harmless: letting it plan and propose while making it impossible for it to cause a bad action. And the IPv6 bug that silently disabled the fallback.

---

## 9. Round 2 (live changes): get ready

Round 2 gives you something new to change in the code. What is likely, and where it lives (all in `core.js` unless marked):

| They might ask | Where | Time |
|---|---|---|
| "Change the heat limit to 25 °C" / "make 38 °C → 40" | `LIMITS` at the top | 1 min edit |
| "Add a new scenario" (e.g. a leak at 3 PM, or an unoccupied cooling-off request) | `SCENARIOS` list | 5 min |
| "Change the tariff" | `TARIFF` object | 1 min |
| "Change how cautious it is" (evidence cut-offs, weights) | `EVIDENCE`, `evidenceStrength` | 2 min |
| A new curveball like HS-5.1 (planned pool filling) or HS-5.4 (tariff changes on the 15th) | not built; `detectLeak` / `forecastBill` | 30+ min, say so honestly |
| "Make the leak threshold stricter" | `LEAK_MIN_LPH`, `LEAK_NIGHTS` in `LIMITS` | 1 min |
| "Require two approvers" / "approval times out" | `Approval form` node + `applyReview` | harder; say so honestly |
| "Add a new check (e.g. block changes of more than 3 °C at once)" | `heatGuard` function | 10 min |
| "What if the data has duplicates / a new bad pattern?" | `validateMeterRows` | 10 min |

**Deploy cycle** (about 1.5 min): edit `core.js` → run `python make_ecoshield_workflow.py` → `npx -y n8n@2.48.6 import:workflow --input=ecoshield_workflow.json` → `npx -y n8n@2.48.6 publish:workflow --id=va1J6ZZ2bCfcd2mT` → wait about 25 s → run. Then run `node tests/test_core.js` to prove nothing else broke. **Practise this once tonight.** Alternative for a quick edit: change the Code node directly in the n8n editor (the code is pasted in), but then it differs from `core.js`; say so.

**Tip:** say your plan out loud before touching code ("I'll change the limit in one place, add a test, and run scenario 6 again"). Judges reward understanding.

---

## 10. Checklist for tomorrow

Tonight:
- [ ] Read this guide. Say the 60-second version out loud 3 times.
- [ ] Charge the laptop. Start n8n, open the console form, run scenario 2 and approve it.
- [ ] Run `node tests/test_core.js` (should say all 176 pass).
- [ ] Practise one deploy cycle (section 9).
- [ ] Sleep. You will explain better rested than with 20 more minutes of cramming.

Morning, before 10:00:
- [ ] Close Chrome tabs you don't need (Ollama needs the RAM). Plug in the charger.
- [ ] Start n8n (`npx -y n8n@2.48.6 start`), wait for it, open the form and the dashboard.
- [ ] Run scenarios 2, 1, 10, 6, 11 once.
- [ ] Run `node tests/quota_run.js 3` if there's time (checks Groq limits at that moment).
- [ ] Test once with Groq switched off to prove the fallback works on this laptop.
- [ ] Ask the four organiser questions at the 9:00 briefing.
- [ ] Know who on the team presents and who answers code questions.

Files to know (all in `workspace/techx_n8n/ecoshield/`): `README.md` (how to run, stage table), `PLAN.md`, `CHECKPOINTS.md`, `core.js`, `data/` (CSVs for judges), `../MANUAL_CHECKLIST.md`, `../JUDGE_QA_DRILL.md`, `../ROUND2_DRILLS.md` (those two are from the EcoWatch build, same style of questions).

**Rule for answers:** if you don't know, say "I don't know, I'd check X." That scores better than a confident guess, and it is the same honesty the system itself is built on.
