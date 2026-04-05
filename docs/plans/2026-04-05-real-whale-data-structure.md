# Real Whale Data Structure Implementation Plan

**Goal:** Adapt the local application and ingestion tooling to real whale data
folders while preserving seed-data support for local development and tests.
**Spec:** Conversation-approved design

---

### Task 1: Make spectrogram metadata nullable end to end

**Files:**
- Modify: `api/src/types/entities.ts`
- Modify: `api/src/types/dynamo.ts`
- Modify: `api/src/types/api.ts`
- Modify: `api/src/routes/catalog.ts`
- Modify: `frontend/src/pages/SampleDetailPage.tsx`
- Modify: `frontend/src/pages/SampleListPage.tsx`
- Modify: `tests/src/api-integration.test.ts`

**Acceptance criteria:**
- [ ] Sample and API types allow `spectrogramKey` or `spectrogramUrl` to be
      `null`
- [ ] API responses only resolve a spectrogram URL when a key exists
- [ ] Frontend renders a clear placeholder when a spectrogram is missing
- [ ] Existing seed-data behavior continues to work

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm test` with the seed-data stack running

---

### Task 2: Add ingestion for the real dataset folder structure

**Files:**
- Create: `scripts/src/db-ingest.ts`
- Modify: `scripts/package.json`
- Modify: `package.json`
- Modify: `.env.local.example`

**Acceptance criteria:**
- [ ] `pnpm db:ingest -- --path <dataset>` ingests one dataset directory
- [ ] `pnpm db:ingest -- --path <parent> --all` ingests all dataset
      subdirectories
- [ ] `--dry-run` prints the discovered work without writing to DynamoDB
- [ ] Sample IDs, timestamps, durations, and media keys are derived
      deterministically from the real folder structure

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- Dry-run a real dataset ingest
- Run a real ingest and confirm the app can browse the imported records

---

### Task 3: Update docs for real-data ingestion and local behavior

**Files:**
- Modify: `README.md`
- Modify: `STATUS.md`
- Modify: `MEMORY.md`

**Acceptance criteria:**
- [ ] Local setup docs explain `MEDIA_ROOT` and the real-data folder structure
- [ ] Repo status docs reflect the implemented ingestion support
- [ ] Active planning docs point to a repo-local detailed plan

**Verification:**
- Review the updated docs for consistency with the implemented behavior

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test` after starting the seed-data local stack
4. Manual smoke test with `pnpm dev --seed`
5. Manual smoke test with real-data ingestion when the dataset is available
