# Stage 5 – Cases and courts

Cases (all fields in the spec except assigned advocate), many clients and many parties per case, connected cases (symmetric),
configurable categories (seeded once, fully editable), court directory with custom courts, status changes recorded as chronology events,
case page with tabs, case filters and search (title, case no., reg no., CNR, petitioner/respondent, party names).

Integrity: courts/categories/clients/links cannot be removed while records still use them; removals are soft deletes behind confirmations.

Deferred (and why):
- Assigned advocate: needs team members, built in Stage 6 together with task assignment.
- Hearings, full chronology view, tasks, documents on the case page: Stages 6–7 (events are already being recorded).
- Date inputs use the browser's date picker; stored as YYYY-MM-DD, displayed DD/MM/YYYY.
