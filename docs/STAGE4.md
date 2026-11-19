# Stage 4 – Dashboard and client management

Working end to end on the real data layer: client create / edit / archive / restore, search and filter, client detail
(contact, linked cases, payment history, audit history), duplicate-phone warning, Indian phone / PIN validation,
global search (clients, cases, parties, courts, documents, tasks), dashboard computed from real records, English + Hindi.

- `src/services/` – ClientService, DashboardService, SearchService (UI never touches storage).
- Audit log records actions only, never client content.
- Clients are archived, never silently deleted.
- Dashboard cards for cases, hearings, tasks and fees show real counts but stay 0 until Stages 5–8 add those screens.
- Global search scans tables through the repository; an index is planned for the Stage 11 performance pass.
- Single default local profile until Stage 9 (PIN, profiles, encryption). Data is NOT encrypted yet.

Dexie note: raw primitives return Dexie promises and top-level calls escape ambient transactions; this fixed
TransactionInactiveError / PrematureCommitError with native async code. Covered by contract + service tests on both adapters.
