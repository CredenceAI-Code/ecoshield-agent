# EcoShield: Round 3 demo runbook

For the live demo at the finale. Everything runs **on this laptop**; judges cannot reach it from outside. The hosted page (public, now with CSV upload) is a simulation of the logic (see "If something fails").

## 1. Before you leave home (pre-flight, 10 minutes)

1. Laptop on charger, sleep off, **wifi tested** (Groq is a cloud call; without wifi the agent still works but falls back to the local model and plain code, see section 5).
2. Start Ollama (local model): it must have `qwen3:1.7b` pulled. Check: `ollama list`.
3. Start n8n from the project folder (one window, leave it open):
   ```powershell
   $env:N8N_DIAGNOSTICS_ENABLED="false"; $env:N8N_VERSION_NOTIFICATIONS_ENABLED="false"; $env:N8N_PERSONALIZATION_ENABLED="false"; cd "C:\Users\Ekeshadhulya\Desktop\AKASH CS\jarvis\workspace\techx_n8n\ecoshield"; npx -y n8n@2.48.6 start
   ```
   Do **not** start it twice. Check it is up: open http://localhost:5678/healthz (should say ok).
4. Open these tabs in this order:
   - Console form: `http://localhost:5678/form/be2bf8f1-b886-4585-950c-82bcc0648882`
   - Dashboard: `http://localhost:5678/webhook/ecoshield-dashboard`
   - Hosted demo (backup): `https://credenceai-code.github.io/ecoshield-agent/`
5. Put the sample files where you can reach them quickly: `ecoshield\data\round3_samples\` (7 CSVs, numbered in demo order).
6. Do ONE full dry run (steps in section 2) and then choose **RESET - clear the demo memory** in the form so the demo starts clean.
7. The Groq key lives in n8n's own credential store (credential "httpBearerAuth"). Do not open or show it.

## 2. The live demo (about 2.5 minutes), in order

| # | What you do | What the judges see | Say |
|---|---|---|---|
| 1 | Form: scenario **1 - Overnight hidden pipe leak**, upload `2_overnight_leak_45lph.csv`, Submit | Result page: **LEAK, about 45 L/h**, evidence score 100 (HIGH), "Code HIGH, AI HIGH" on the result page, the AI explanation, an approval form | "Real data in: a meter export, not a canned dropdown." |
| 2 | On the approval form pick **Approve**, type your full name, Submit | "Approved by <name> and applied: close the main water valve" | "A named person signs. The AI cannot." |
| 3 | Form again: scenario 2, upload `7_bad_file_missing_columns.csv` | Rejected before any AI, reason shown | "Bad input never reaches the AI." |
| 4 | Form: scenario **11** (injection note), no file | Rejected before any AI saw it | "Prompt injection stopped by code." |
| 5 | Form: scenario 1, upload leak file, **Failure drill = Groq outage** | Slower; explanation from the local model or template; the AI second opinion is missing, so the leak alert is held for a named person (fail closed) | "We break the cloud AI on purpose. The rules still hold." |
| 6 | Dashboard | Table of runs, each replayable from the log | "Everything is in the audit log." |

For the **approval timeout** (only if asked, it needs about 70 seconds): form with scenario 1, set **Approval wait limit = 1**, submit, do NOT answer the approval form. After about a minute the audit log gets an `approval_timeout` line and nothing is changed.

## 3. If asked "can you show a batch?"

Run in a second terminal (it takes a few minutes):
```powershell
cd "C:\Users\Ekeshadhulya\Desktop\AKASH CS\jarvis\workspace\techx_n8n\ecoshield"; node tests/batch_run.js
```
It sends 5 different inputs one after another and prints a table (time, verdict, rule, AI used, run id). Results of our own earlier runs are in `tests\batch\`. **Do not run it during the 7-minute pitch**; show the saved table instead.

## 4. Reset between attempts
Form -> scenario **RESET - clear the demo memory**.

## 5. If something fails (decide in 10 seconds)

| Problem | What to do | What to say |
|---|---|---|
| No wifi / Groq unreachable | Carry on. The chain falls back: second cloud model, then the local model, then plain code. Results stay correct, text may be plainer | "Cloud AI is optional. Safety is plain code." |
| Ollama not running | Same, falls through to the plain-code template | same |
| n8n page not loading | Check the n8n window is still running; restart it with the command in section 1 (about 20 seconds) | "Restarting the local server." |
| n8n will not come back in 1 minute | Switch to the hosted demo tab. Upload a CSV there too (same rules in the browser) | "This is the same logic running in the browser; the n8n run is on the recording." |
| Everything fails | Show the saved evidence: `EcoShield_Round3_Submission\` has the log excerpts, the batch table and screenshots | "Here is the same run recorded earlier." |

## 6. What is real and what is not (say this if asked)
- Real: the n8n workflow, the planner loop, the guard, the approval step with its timeout, the audit log, the Groq calls and the local model.
- Simulated: the building. The meter data is synthetic, the tariff is a simplified DEWA tariff, and the valve and thermostat are a simulated device. No real school was connected.
