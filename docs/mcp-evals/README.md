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
