# Stage 1 – Scaffold and foundations

Done: Vite + React + TypeScript + Tailwind scaffold, design tokens (navy / slate / muted semantic colours, Inter bundled locally),
app shell (sidebar on desktop, bottom nav on mobile), English/Hindi UI switch, and tested domain primitives:
integer-paise money with Indian grouping, plain-date helpers (DD/MM/YYYY), UUID v7.

Not done yet (by design): persistence, security, every feature module. Routes show an honest "Not built yet" page and store nothing.

Run: `npm install`, `npm run dev`, `npm test`, `npm run build`.
Next: Stage 2 (design system components), then Stage 3 (repository interfaces, Dexie/SQLite adapters, migrations).

# Stage 2 – Design system

`src/design-system`: Button, TextField / TextAreaField / SelectField (label, hint, error, aria wiring, RHF-compatible refs),
MoneyField (text in, integer paise out), Modal (focus trap, Escape, focus restore), ConfirmDialog (all destructive actions),
toasts, DataTable (table on desktop, labelled cards on phones, keyboard-activatable rows), Badge, EmptyState, PageHeader.
Covered by `design-system.test.tsx` (RHF + Zod validation flow included).
