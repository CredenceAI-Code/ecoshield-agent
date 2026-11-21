# EcoShield on a Mac (16 GB): setup, about 30 minutes

Everything the project needs is in this folder. Three things do **not** travel and must be made fresh on the Mac: n8n itself, the Groq key credential, and n8n's memory (past runs). The key is never in the files.

## 0. What your teammate needs
- A free **Groq** account and **their own** API key (console.groq.com). Do not send a key over chat or email. Limits are per account, so a second key also doubles the free quota.
- Node.js **20.19 to 24** (nodejs.org, LTS installer). Check: `node -v`.
- Python 3 (`python3 --version`; macOS offers to install it if missing).
- Ollama for Mac (ollama.com). Optional but recommended: it is the offline fallback.

## 1. Check the logic works (no n8n needed, 10 seconds)
```
cd ecoshield
node tests/test_core.js
```
Expected: it ends with a pass count and `0 failed` (176 checks).

## 2. Start n8n and make the Groq credential
```
export N8N_DIAGNOSTICS_ENABLED=false N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_PERSONALIZATION_ENABLED=false
npx -y n8n@2.48.6 start
```
1. Open http://localhost:5678 and create the owner account (any email and password, kept on that Mac only).
2. Credentials, Create credential, **Bearer Auth**. Name it exactly `Groq key`. Paste the Groq key as the token. Save.
3. Open that credential and read its id from the address bar: `.../credentials/<ID>`. Copy the ID.

## 3. Build and import the workflow (second terminal tab, inside `ecoshield`)
```
mkdir -p ~/.n8n-files
ECO_GROQ_CRED_ID=<ID> python3 make_ecoshield_workflow.py
npx -y n8n@2.48.6 import:workflow --input=ecoshield_workflow.json
npx -y n8n@2.48.6 publish:workflow --id=va1J6ZZ2bCfcd2mT
```
Wait about 25 seconds. Why regenerate instead of importing the exported JSON: the exported file has the Windows path of the audit log and the old credential id baked in. Regenerating writes the Mac's own `~/.n8n-files/ecoshield_audit.jsonl` and the new credential id. (`~/.n8n-files` must exist: n8n only lets file nodes write there.)

Open:
- Console: http://localhost:5678/form/be2bf8f1-b886-4585-950c-82bcc0648882
- Dashboard: http://localhost:5678/webhook/ecoshield-dashboard

## 4. Ollama (offline fallback)
```
ollama pull qwen3:1.7b
```
That is the model we tested. With 16 GB you could use `qwen3:4b` (better answers), but the name `qwen3:1.7b` appears in the generator and the tests were run on 1.7b only. Changing it means editing the generator and re-running the checks. Not recommended the night before the event.

## 5. Check it end to end
1. Console form, scenario `1`, Operator note blank, submit. Expect an approval form: choose Approve, type a name, submit. The result page says "Approved by <name> and applied".
2. Console form, scenario `6`: expect "Blocked by a hard rule" and one or two replan attempts.
3. Optional full check: `node tests/sim_workflow.js` (expects 221 passed) and `node tests/live_run.js` (83 passed; this one runs every scenario against the live n8n and takes several minutes).
4. Switch Groq off in a test (disconnect Wi-Fi) and run scenario 1 again: it should still finish using Ollama, only slower.

## 6. What does not transfer
- The n8n **memory** (earlier runs, undo stack, devices). Use "RESET - clear the demo memory" on the console before the demo so it starts clean.
- n8n credentials and execution history.
- Any change made in the n8n editor by hand. To keep a change, edit the generator or core.js and regenerate.

## 7. Files in this folder
- `CLAUDE.md` a short project brief that Claude Code reads automatically when started in this folder, so it has the context.
- `event_docs/` the organisers' manual and the Domain 5 statement.
- `core.js` all the safety, leak and bill logic; `page_js.js` the result and dashboard pages; `make_ecoshield_workflow.py` builds `ecoshield_workflow.json` (43 nodes).
- `EcoShield_Workflow_Node_Notes.pdf` / `.md` what every node does; `study_pdf/EcoShield_Round1_Study_Guide.pdf` the 18-page study guide; `ARCHITECTURE_NOTE.md` the judge-facing note; `PLAN.md`, `CHECKPOINTS.md`, `README.md`, `STUDY_GUIDE.md`.
- `EcoShield_Agent_export_2026-11-20_v5.json` the exact workflow exported from the Windows laptop (a backup; use step 3 instead of importing it directly).
- `data/` the synthetic meter data and scenarios; `tests/` the checks.

## 8. Honest limits
The tariff is assumed, the 38 °C limit is our guess, the device is simulated, and the Groq free tier has daily limits. See the notes PDF, "Open items and known limits".
