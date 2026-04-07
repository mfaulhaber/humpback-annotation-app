# Session Deploy Workflow Implementation Plan

**Goal:** Add a manual `session-deploy` workflow command that can deploy or
redeploy the active viewer-only AWS stack, publish the current frontend bundle,
and upload export data when new local detection jobs need to be published.
**Spec:** `docs/specs/2026-04-07-session-deploy-workflow-design.md`

---

### Task 1: Add the `session-deploy` workflow and command mirror

**Files:**
- Create: `docs/workflows/session-deploy.md`
- Create: `.claude/commands/session-deploy.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Acceptance criteria:**
- [ ] The repo defines `session-deploy` as an optional manual workflow for the
      active viewer-only AWS path rather than a new default delivery phase
- [ ] The workflow documents preconditions, including clean-tree expectations,
      detached-HEAD handling, required deploy environment, and the active
      viewer-only deployment scope
- [ ] The `.claude/commands/` entry mirrors the workflow doc and stays aligned
      with `docs/workflows/`
- [ ] Repo docs that enumerate workflow files or commands include
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
- [ ] The repository exposes a repeatable command for the smart deploy helper,
      for example `pnpm deploy:viewer`
- [ ] The helper can detect whether the configured CloudFormation stack exists
      and can resolve the deployed app bucket, data bucket, and CloudFront
      distribution outputs
- [ ] The helper runs `pnpm cdk:synth` as a baseline check, runs a
      machine-checkable CDK diff when the stack exists, and runs
      `pnpm cdk:deploy` only when the stack is missing or the diff reports
      infrastructure changes
- [ ] The helper publishes the frontend bundle once deploy outputs are ready
- [ ] The helper inspects the local export root and remote data bucket so it
      publishes export data when remote `index.json` is missing, local
      `index.json` changed, or a local job is missing a remote
      `<jobId>/manifest.json`
- [ ] The helper supports dry-run reporting plus force/skip flags for the data
      publish path
- [ ] The helper prints a concise summary of executed steps, skipped steps, and
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
- [ ] README explains when to use `session-deploy`, which environment variables
      must be set, and how the smart data-upload heuristic behaves
- [ ] The deploy environment example documents the inputs needed for
      first-time deploys, redeploys, and local export-root based data publishes
- [ ] The docs explain how to force a data publish when an existing exported
      job changed without adding a new job ID
- [ ] All deploy-facing docs remain truthful about what is implemented versus
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
   - data publish runs when a local detection job is absent remotely
   - data publish is skipped with a clear reason when no new local job is found
