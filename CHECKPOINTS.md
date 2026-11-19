# EcoShield: what was planned first, and every human checkpoint

Manual p33 item 14: "You wrote and reviewed PLAN.md before any code, and checked the agent's work at every human checkpoint."

## The honest timeline (file times are real, from the disk, 2026-11-19, Dubai time)

| When | What | Who |
|---|---|---|
| 13:33 | `../STATEMENT_ANALYSIS.md` written from the emailed statement | Claude |
| **13:44** | **PLAN.md written (Python design), now kept as `PLAN_v0_python_design_2026-11-19.md`** | Claude, before any EcoShield code |
| 18:15 | first EcoShield code file (`export_csv.js`; core.js was being built alongside) | Claude |
| 18:25 | first runnable workflow export (v1, 10 scenarios) | Claude, after the n8n decision |
| 19:13 onward | v2, v3, v4 (see the checkpoints below) | Claude, each after a request from Akash |

So the true statement for judges is: **a written plan existed about 4.5 hours before the first line of EcoShield code. The platform in that plan (Python) was changed to n8n by Akash's decision, and the plan was rewritten afterwards to match the build (`PLAN.md`, with a plan-versus-build table in section 8).** Do not say the n8n build followed the plan step by step. It followed the plan's design; it did not follow its phases.

## Human checkpoints (decisions Akash made after seeing results)

Reconstructed from the chat history on 2026-11-19. They were not logged live and have no timestamps beyond the date. Each line is something he decided or asked for, not something Claude assumed for him.

1. **2026-11-18, platform:** he chose n8n over Python (Claude had recommended Python). "School account is fine."
2. **2026-11-19, scope:** after the statement arrived he asked for the EcoShield logic built in local n8n plus an audit log ("A AND B").
3. **2026-11-19, stage coverage:** he sent the manual's 10-stage diagram and asked whether the build covered every stage; reviewed Claude's stage-by-stage answer (several NO and PARTIAL).
4. **2026-11-19, v2:** he asked for every NO and PARTIAL to become a yes. Result reviewed through the README caveats.
5. **2026-11-19, multi-agent diagram:** he asked whether the build matched it. Answer: no, single agent, and the manual says single is fine. He did not ask for multi-agent.
6. **2026-11-19, manual:** he asked for every expectation in the manual as a tagged list (`../MANUAL_CHECKLIST.md`).
7. **2026-11-19, v3:** he asked for the three partials (Ollama-only run, replan loop, PLAN.md) to be built and tested.
8. **2026-11-19, v4:** he chose items 1, 2, 3, 4, 5 and 7 of the open list (scenarios 13 and 14, Git repo, second Groq model, approver note, README column, quota test).
9. **2026-11-19, this file:** he asked for item 14 to be made as true as possible.

What is NOT true and is not claimed: he did not review each build phase against a written checkpoint form, and there is no per-phase sign-off log.

## Sign-off

- PLAN.md read in full by: **Akash**, on **2026-11-19** (told Claude "done" after it opened PLAN.md for him to read; recorded by Claude on his word, not independently checked)
- Reviewer's note (optional): none given

Scope of this sign-off: he read the as-built PLAN.md, including the history paragraph and the plan-versus-build table. It does not turn the n8n plan into one written before the code.
