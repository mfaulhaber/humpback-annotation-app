# Session Deploy Workflow Implementation Plan

**Goal:** Add a manual `session-deploy` workflow command that can deploy or
redeploy the active viewer-only AWS stack, publish the current frontend bundle,
and verify that the deployed data bucket matches the local export root without
automatically uploading export data.
**Spec:** `docs/specs/2026-04-07-session-deploy-workflow-design.md`

---

### Task 1: Add the `session-deploy` workflow and command mirror

**Files:**
- Create: `docs/workflows/session-deploy.md`
- Create: `.claude/commands/session-deploy.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Acceptance criteria:**
- [x] The repo defines `session-deploy` as an optional manual workflow for the
      active viewer-only AWS path rather than a new default delivery phase
- [x] The workflow documents preconditions, including clean-tree expectations,
      detached-HEAD handling, required deploy environment, and the active
      viewer-only deployment scope
- [x] The `.claude/commands/` entry mirrors the workflow doc and stays aligned
      with `docs/workflows/`
- [x] Repo docs that enumerate workflow files or commands include
      `session-deploy` without implying that the dormant annotation stack is
      part of this deploy path

**Verification:**
- Review the updated workflow and command docs for alignment and truthful scope

---

### Task 2: Implement a smart viewer deploy helper in `scripts/`

**Files:**
- Modify: `package.json`
- Modify: `scripts/package.json`
- Modify: `scripts/src/publish-support.ts`
- Create: `scripts/src/session-deploy.ts`

**Acceptance criteria:**
- [x] The repository exposes a repeatable command for the smart deploy helper,
      for example `pnpm deploy:viewer`
- [x] The helper can detect whether the configured CloudFormation stack exists
      and can resolve the deployed app bucket, data bucket, and CloudFront
      distribution outputs
- [x] The helper runs `pnpm cdk:synth` as a baseline check, runs a
      machine-checkable CDK diff when the stack exists, and runs
      `pnpm cdk:deploy` only when the stack is missing or the diff reports
      infrastructure changes
- [x] The helper publishes the frontend bundle once deploy outputs are ready
- [x] The helper inspects the local export root and remote data bucket so it
      fails when objects are missing remotely, extra remotely, mismatched in
      size, or mismatched in normalized JSON content
- [x] The helper supports dry-run reporting plus the `--skip-data` flag for the
      data verification path and rejects the removed `--force-data` behavior
- [x] The helper prints a concise summary of executed steps, skipped steps, and
      resulting deployment identifiers or URLs

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- Manual dry-run smoke of the smart deploy helper
- Manual deploy smoke against a configured AWS environment

---

### Task 3: Document operator usage and deploy inputs

**Files:**
- Modify: `README.md`
- Modify: `.env.deploy.example`
- Modify: supporting repo docs as needed

**Acceptance criteria:**
- [x] README explains when to use `session-deploy`, which environment variables
      must be set, and how the data verification behavior works
- [x] The deploy environment example documents the inputs needed for
      first-time deploys, redeploys, and local export-root based verification
- [x] The docs explain that operators must run explicit data sync or publish
      commands outside `session-deploy` when the bucket is out of sync
- [x] All deploy-facing docs remain truthful about what is implemented versus
      still manual or future work

**Verification:**
- Review all updated deploy docs for consistency with the implemented helper
- Smoke the documented dry-run example command

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. Manual dry-run of the smart deploy helper
4. Manual smoke against a configured AWS environment:
   - first-deploy or redeploy path chooses the correct CDK step
   - app publish runs with resolved stack outputs
   - data verification fails with a clear reason when local and remote drift
   - data verification passes when the local export root and deployed bucket
     match
