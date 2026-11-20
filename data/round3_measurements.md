# Round 3 measurements (from the audit log)

Runs counted: 31 ({"groq-20b":31}), since 2026-11-20T20:50:01Z.

- Tokens per request: median 1083 in + 211 out = 1301; p95 1345; max 1680
- AI calls per request: median 3, max 4
- Cost per request (Groq, USD): median 0.000146, p95 0.000200, max 0.000210
- Machine time per request: median 4.4 s, p95 6.7 s, max 9.9 s (human wait removed); Groq-answered only: median 4.4 s

| requests/day (assumption) | USD/day | USD/month | tokens/day |
|---|---|---|---|
| 10 | 0.0015 | 0.044 | 13010 |
| 50 | 0.0073 | 0.22 | 65050 |
| 500 | 0.0732 | 2.196 | 650500 |
