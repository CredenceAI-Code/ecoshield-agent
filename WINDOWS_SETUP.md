# EcoShield on a Dell (Windows): setup, about 20 minutes

Same steps as our own laptop. Three things do **not** travel and must be made fresh: n8n itself, the Groq key credential, and n8n's memory (past runs). The key is never in the files. Use **PowerShell** for every command below.

## 0. What is needed
- A free **Groq** account and an API key (console.groq.com). Never put the key in chat, a file or a message.
- **Node.js LTS, version 20.19 to 24** (nodejs.org). Check: `node -v`.
- **Python 3** (python.org; tick "Add to PATH"). Check: `python --version`.
- **Ollama for Windows** (ollama.com), optional but it is the offline fallback.

## 1. Unzip and check the logic (10 seconds)
Unzip to a folder such as `C:\Users\<name>\Desktop\ecoshield_transfer`. Then:
```
cd $HOME\Desktop\ecoshield_transfer\ecoshield
node tests/test_core.js
```
Expected: ends with `176 passed, 0 failed`.

## 2. Start n8n (leave this window open)
```
$env:N8N_DIAGNOSTICS_ENABLED="false"; $env:N8N_VERSION_NOTIFICATIONS_ENABLED="false"; $env:N8N_PERSONALIZATION_ENABLED="false"
npx -y n8n@2.48.6 start
```
1. Open http://localhost:5678 and create the owner account (any email and password; stays on this laptop).
2. Credentials, Create credential, **Bearer Auth**. Name it exactly `Groq key`. Paste the Groq key as the token. Save.
3. Open the credential and read its id from the address bar: `.../credentials/<ID>`.

## 3. Build and import the workflow (a second PowerShell window, inside `ecoshield`)
```
New-Item -ItemType Directory -Force "$HOME\.n8n-files"
$env:ECO_GROQ_CRED_ID="<ID>"
python make_ecoshield_workflow.py
npx -y n8n@2.48.6 import:workflow --input=ecoshield_workflow.json
npx -y n8n@2.48.6 publish:workflow --id=va1J6ZZ2bCfcd2mT
```
Wait about 25 seconds. Why regenerate instead of importing the exported JSON: the export has the first laptop's audit-log path and credential id baked in.

Open:
- Console: http://localhost:5678/form/be2bf8f1-b886-4585-950c-82bcc0648882
- Dashboard: http://localhost:5678/webhook/ecoshield-dashboard

## 4. Ollama (offline fallback)
```
ollama pull qwen3:1.7b
```
Keep `qwen3:1.7b`: it is the model all our tests used.

## 5. Check it works
1. Console, scenario `1`, submit, then Approve with a name. The page says "Approved by <name> and applied".
2. Scenario `6`: "Blocked by a hard rule". Scenario `11`: "Rejected before any AI saw it".
3. Optional: `node tests/sim_workflow.js` (221 passed).
4. Before the demo run **RESET - clear the demo memory** on the console.

## 6. After the event
Delete the `Groq key` credential in n8n, revoke the key at console.groq.com if it was created for this laptop, close n8n (Ctrl+C), and log out of any account used here.

See `CLAUDE.md` (project brief) and `EcoShield_Workflow_Node_Notes.pdf` (what every node does).
