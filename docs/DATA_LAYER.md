# Stage 3 – Data layer

**Rule:** UI → Zustand/services → `Repository` interface → adapter. Components never touch Dexie or SQLite.

- `src/data/schema.ts` – single source of truth for all 25 tables (your 24 + `case_categories`). Money columns are integer paise.
- `repositories/Repository.ts` – the interface and typed errors (Validation, Referential, Conflict, NotFound, SchemaTooNew).
- `repositories/BaseRepository.ts` – all business rules shared by both adapters: validation, foreign-key checks,
  optimistic versioning, soft delete (refused while live rows reference the record), gap-free sequences.
- `web/DexieRepository.ts` – IndexedDB adapter; `android/SqliteRepository.ts` – SQLite adapter behind `SqlDriver`.
- `android/migrations.ts` – numbered migrations, each transactional; refuses databases newer than the app.
- `contract-tests/` – one suite run against both adapters (CRUD, FKs, many-to-many, transactions, concurrency, profile isolation).

## Adding a migration
SQLite: append `{version, description, statements}` to `MIGRATIONS`. Web: add `db.version(n).stores(...).upgrade(...)` in `openAdvocateDb`.
Bump `SCHEMA_VERSION`. A parity test fails if the two schemas diverge.

## Known gaps (scheduled, not hidden)
- Capacitor SQLite/SQLCipher driver: Stage 10 (tests use Node's built-in SQLite, which is unencrypted).
- Encryption of sensitive web fields, PIN, profile creation: Stage 9. Data is currently stored unencrypted.
- Full-text/global search: Stage 4 (built on these repositories).
- Typed entity models per feature (Zod): added with each feature stage; the repository validates column types and nullability now.
- Document files (OPFS): Stage 7.
