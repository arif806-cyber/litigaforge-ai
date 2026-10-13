# MCP evaluation fixtures

`quality-queries.json` contains 30 prompt/tool cases spanning every public and
authenticated MCP tool. `injection-cases.json` contains 10 hostile-source
fixtures covering tool-policy override, data disclosure, fabricated legal
claims, and source spoofing.

These are evaluation inputs and expected behavior checks, not passing model
results. Run them only against an isolated test account/database with
`MCP_V2_ENABLED=true`; use fictional case identifiers and do not send real
client data. A release report must record the model/client, date, per-case
result, and any failures. No live Claude run is claimed by these fixtures.

For the development reviewer, configure `MCP_REVIEWER_EMAIL` and
`MCP_REVIEWER_PASSWORD` in Replit Secrets, then run
`python tests/seed_dev_mcp_reviewer.py seed` from `artifacts/litigaforge-ai`.
The seed refuses production, creates only a dedicated reviewer identity, and
grants the existing 30-day Reviewer plan with fictional cases and public
judgments. The evaluation runner uses OAuth PKCE against the configured dev
server and never prints the reviewer credentials or access token.
