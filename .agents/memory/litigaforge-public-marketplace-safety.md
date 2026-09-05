---
name: LitigaForge public marketplace safety
description: Production safety boundaries for the public advocate directory and lawyer matching.
---

Public advocate responses must use an explicit field allowlist and include only
human-verified, non-test profiles. Anonymous responses never include email,
phone, bar enrolment number, subscription data, or internal user identifiers.

**Why:** Test profiles and advocate contact details were previously visible on
the public production endpoint. Marketing claims must reflect live verified
supply rather than seeded or fabricated counts.

**How to apply:** Any new directory, detail, search, or matching endpoint must
reuse the same verified/non-test eligibility boundary and a public serializer.
Do not expose contact details before an accepted match.

Matching must fail closed at every public entry point while the feature flag is
off. Empty districts never count as location overlap; statewide eligibility
must be explicit.

**Why:** Gating only the case-creation caller still leaves direct matching
routes able to create results. Empty-string substring checks can also match
every location accidentally.

**How to apply:** Enforce the flag inside the matching service/endpoint before
database work, not only at callers. Keep it disabled until verified local
advocate supply and operational approval exist.