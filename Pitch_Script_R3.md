# EcoShield Round 3: 7-minute pitch script

Say it in your own voice; the sentences are short on purpose. About 950 words = 7 minutes at a calm pace. **Bold = click or action.** Slide numbers match `EcoShield_Round3_Deck.pdf` (11 slides). Pre-flight and failure table: `ROUND3_DEMO_RUNBOOK.md`.

Before you start: n8n running, 3 tabs open (console form, dashboard, hosted demo), memory RESET, sample files ready, deck on slide 1.

---

## 0:00 – 1:00  Problem, user, what changed  (slides 1, 2)

**Slide 1.** "We are team Visionaries from Credence High School, Dubai. This is EcoShield."

**Slide 2.** "Our user is a school facilities manager. They pay the water and power bills and they answer for safe rooms. A pipe can leak all night and nobody sees it. And an automation can switch the cooling off in 46 degree heat. EcoShield finds the leak, blocks the unsafe change, and asks a named person before anything risky happens."

"One rule runs through everything: the AI talks, code decides, a human approves."

"After Round 2 it worked, but the data came from a dropdown, an approval could wait forever, and we had no cost or speed numbers. Today we fixed those. You can upload a real meter file. An approval now has a wait limit with a safe default. And we load tested it and measured it."

---

## 1:00 – 3:30  Live demo  (slide 3, then the browser)

**Slide 3** (10 seconds): "This is the workflow: trigger, validate, agent acts, approve, output. 42 nodes in n8n."

**Switch to the console form.**

1. (0:30) **Scenario 1, upload `2_overnight_leak_45lph.csv`, Submit.** "This is a meter export, not a canned scenario." Result page: **LEAK, 45 litres an hour, evidence score 100.** "The AI wrote this explanation. The maths and the score are plain code. Then the AI gives a second opinion on how strong the evidence is, from plain facts, no score. Code says HIGH, the AI says HIGH, both agree, so the agent may act alone. If they disagree, a person decides."
2. (0:20) **On the approval form: Approve, type your full name, Submit.** "Closing the main valve is risky, so a named person signs. The AI cannot." Page shows approved by your name.
3. (0:20) **Form: scenario 2, upload `7_bad_file_missing_columns.csv`.** "Bad input is rejected before any AI sees it."
4. (0:20) **Form: scenario 11 (injection note).** "A note that tries to override our safety limits. Stopped by code, before the AI."
5. (0:30) **Form: scenario 1, leak file, Failure drill = Groq outage.** "Now we break the cloud AI on purpose." Result appears slower, same safe answer. "The local model answered. The rules did not change."
6. (0:10) **Dashboard.** "Every run is here, and replayable from the log."

**Saying it while the page loads:** "Five inputs, one after another, all completed. Five at once, all completed in 40 seconds. We have the table on slide 4."

If a step is slow, keep talking over it; do not click twice.

---

## 3:30 – 5:30  Safety: three cases with log IDs  (slides 4, 5, 6)

**Slide 4** (30 s): "We sent five inputs back to back and then five at once. All five completed both times. The slowest, 110 seconds, was the outage drill on the small local model. The all-at-once test found a real limit: simultaneous runs share one memory, so some updates are lost. The audit log stays complete. We list it on the limitations slide."

**Slide 5** (60 s): "Three live cases. Each has a log ID."
- "Safe auto-action, ES-MWPGXZZG. A meter file with a 45 litre leak. Code scores the evidence at 100. Because that is high, the agent raises a leak alert by itself. (This logged run is from before we added the AI second opinion; the live demo now shows both.) The valve shutoff after it still needed a person, and we rejected it."
- "Paused for approval, ES-MWPGYF6B. A valve shutoff waits for a named person. Nobody answered in one minute. The safe default fired: nothing is written, and the valve stays open."
- "Blocked attack, ES-MWPH014K. A note says ignore all safety limits and close the valve without approval. Input validation rejected it. Zero AI calls were made."

**Slide 6** (30 s): "These are real lines from the audit log. Time, run ID, who acted, the step, the input file name, the result, the approver. The log is an append-only file today. For a pilot it needs a database and a retention rule."

---

## 5:30 – 6:30  Deployment, cost, latency, limits  (slides 7, 8, 9)

**Slide 7** (15 s): "A supervised pilot on exported files. Two to three facilities staff and about 50 requests a day. Those two numbers are our assumptions, not measurements."

**Slide 8** (25 s): "We measured 31 real runs from the audit log. A request is about 1,300 tokens and three AI calls. That costs about 0.00015 dollars. At 50 requests a day, about 22 cents a month. Machine time is a median of 4.4 seconds, with the human wait removed. One honest detail: the explanation was always written by the small 20B model, and the larger 120B model fell back to it on fast runs. We cost what actually answered."

**Slide 9** (20 s): "What we do not claim. It is not connected to a real building: the data is synthetic and the valve is simulated. Concurrent runs lose memory updates. Two planned features are not built. The evidence weights are our design, not calibrated on real buildings. A real pilot needs data access, named approvers, a database, and a security review."

---

## 6:30 – 7:00  Value and trade-offs  (slides 10, 11)

**Slide 10** (20 s): "A 45 litre leak wastes over a thousand litres a day. We find it in seconds, not on the next bill. In every test, zero changes were written without a named approver. We chose a small cheap AI plus plain code over a big model deciding, and human approval over full automation. The price is speed on risky changes."

**Slide 11** (10 s): "Thank you. Our code and the hosted demo are on the last slide. Happy to take questions."

---

# Q&A cheat sheet (5 minutes)

Keep answers to two sentences. If you do not know, say "we did not test that."

1. **Is it connected to a real building?** No. Meter data is synthetic, the tariff is a simplified DEWA tariff, the valve and thermostat are simulated. The pilot starts on exported files with no controls attached.
2. **What stops the AI from doing something unsafe?** It never writes anything. It only orders four allow-listed tools and writes the explanation. Code validates input, does the maths, enforces limits, and a named person approves risky changes.
3. **What if nobody approves?** After the wait limit (default 15 minutes, 1 to 60) nothing is written, the log says "timed out", and the action stays held for a named person. We showed it live with a 1-minute limit.
4. **What if Groq is down?** Chain: Groq 120B, Groq 20B, local Ollama model, then a plain-code template. We ran this as a drill. The safe result was the same; the text is plainer and it took about 110 s.
5. **How do you stop prompt injection?** Notes are scanned by code before any AI, and are never sent to an AI. The injection case was rejected with zero AI calls. Honest limit: a filter is a pattern list, not a guarantee.
6. **What does it cost?** About $0.00015 per request, measured on 31 runs. $0.22 a month at 50 a day is an assumption. Prices are from Groq's published list read on 21 Nov 2026.
7. **How fast is it?** Median 4.4 s machine time, slowest 9.9 s, with the human wait removed. Local-model fallback is much slower.
8. **Why only 5 inputs in the load test?** It is a small test, and we say so. The finding that matters: simultaneous runs lose some memory updates. For a pilot we would move memory to a database.
9. **What is the evidence score, and does the AI use it?** 0 to 100, computed by code. A separate AI second opinion (from plain facts, not the score) says HIGH, MEDIUM or LOW. The agent acts alone only if both say HIGH; if either says MEDIUM or higher a named person reviews; the AI can hold an action back but never make the agent act alone. Code score:  It starts at 100 and loses points for missing night readings, impossible readings, two meters disagreeing, a stale feed, a short history and a weak signal. Every deduction is listed with its reason. Weights are our design and not calibrated on real buildings.
10. **Who is the approver?** One named person on duty at a time, who types their full name. The name is written in the log.
11. **Where are the logs and who can change them?** An append-only file on the machine running n8n. Anyone with admin access to that machine could edit it, so a pilot needs a database with access control.
12. **Did you use any private data?** No. Everything is synthetic. No occupancy data goes to the cloud AI; only allow-listed result fields do.
13. **Why n8n?** Visible nodes, a built-in approval form, easy to replay and audit, and one exported JSON file to deploy.
14. **What would you build next?** Move memory and the audit log to a database, add email or phone approval, calibrate the evidence score on a real school's meter data.
15. **Which parts did you write?** Students wrote the code (Akash, Badin, Aahil). No outside security review yet. (Say who built which part, from your own roles.)
16. **Is the hosted link the real system?** The hosted page is public: judges can open it and upload a CSV. It runs the same rules in the browser as a simulation. The live n8n workflow (planner, AI explanation, approval wait limit, batch, failure drill) runs on our laptop.

---

# If the live demo dies (decide in 10 seconds)

| Situation | Do this |
|---|---|
| n8n page will not load | Say "restarting the local server", check the n8n window, restart with the runbook command (about 20 s). Keep talking over slide 3. |
| Back after a minute and still dead | Switch to the hosted demo tab and upload the CSV there. Say "same logic in the browser; the n8n run is on the recording." |
| Wifi down | Carry on. The chain falls back to the local model; the result stays correct, the text is plainer. |
| Everything dead | Go to slide 3 (live-run screenshot), slide 5 and 6 (log IDs and lines) and tell the same story from the saved evidence in `EcoShield_Round3_Submission\`. |
| Approval form stuck | Say "this is the safe default: nothing is written", then show slide 5 case 2. |

Do not run the batch script during the pitch. Show slide 4 instead.
