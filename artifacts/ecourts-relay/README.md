# Archived eCourts relay — disabled

This directory contains an obsolete relay for the retired eCourts.gov.in
integration. It is not part of the active LitigaForge production workflow.
The current backend connects directly to
`https://webapi.ecourtsindia.com` with the documented Partner API and server-side
Bearer authentication.

The active client intentionally ignores `ECOURTSINDIA_API_BASE`, so this relay
cannot be selected through environment configuration. The Python and Cloudflare
Worker entry points return HTTP 410 and must not be deployed or used. Keep this
directory only as a historical migration record.
