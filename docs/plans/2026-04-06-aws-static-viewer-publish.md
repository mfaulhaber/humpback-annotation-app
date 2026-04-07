# AWS Static Viewer Publish Implementation Plan

**Goal:** Publish the active humpback timeline viewer to AWS as a static
CloudFront-backed site with same-origin `/data/*`, while keeping the legacy
annotation app out of deployment scope.
**Spec:** `docs/specs/2026-04-06-aws-static-viewer-publish-design.md`

---

### Task 1: Scaffold the static viewer hosting stack in CDK

**Files:**
- Modify: `cdk/package.json`
- Modify: `cdk/src/index.ts`
- Modify: `cdk/src/synth.ts`
- Create: `cdk/src/app.ts`
- Create: `cdk/src/config.ts`
- Create: `cdk/src/stacks/static-viewer-stack.ts`

**Acceptance criteria:**
- [ ] `pnpm cdk:synth` produces a real CloudFormation template instead of a
      placeholder message
- [ ] The stack provisions one CloudFront distribution with separate private S3
      origins for the app bundle and `/data/*` timeline artifacts
- [ ] SPA fallback behavior supports `/` and `/:jobId` without rewriting
      missing `/data/*` objects to `index.html`
- [ ] The stack can support an initial CloudFront domain and an optional custom
      domain/TLS configuration without introducing API, Lambda, or DynamoDB
      resources

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- `pnpm cdk:synth`

---

### Task 2: Add repeatable publish commands for the app bundle and timeline data

**Files:**
- Modify: `package.json`
- Modify: `scripts/package.json`
- Modify: `scripts/src/index.ts`
- Create: `scripts/src/publish-static-viewer.ts`
- Create: `scripts/src/publish-timeline-data.ts`
- Create: `.env.deploy.example`

**Acceptance criteria:**
- [ ] The repository provides one command to upload the built frontend bundle to
      the app bucket with correct cache-header treatment for `index.html` and
      hashed assets
- [ ] The repository provides a separate command to publish a local export root
      to the timeline-data bucket for `/data/*`
- [ ] Publish commands fail clearly when required AWS or path inputs are
      missing
- [ ] The data publish path excludes legacy annotation artifacts and local-only
      media folders

**Verification:**
- `pnpm typecheck`
- `pnpm build`
- Manual dry-run or non-destructive command smoke for both publish commands

---

### Task 3: Document the viewer-only AWS deployment path and archive the legacy app from release scope

**Files:**
- Modify: `README.md`
- Modify: `STATUS.md`
- Modify: `MEMORY.md`
- Modify: `DECISIONS.md`

**Acceptance criteria:**
- [ ] README explains how to deploy the active timeline viewer to AWS and which
      inputs are required
- [ ] STATUS and MEMORY describe the static viewer deployment shape without
      implying the legacy annotation stack is part of the AWS release
- [ ] `DECISIONS.md` records the chosen static-hosting architecture if the CDK
      implementation finalizes it
- [ ] The docs explicitly state that the legacy annotation app is archived from
      this deployment plan and remains out of scope

**Verification:**
- Review all updated docs for consistency with the implemented stack and
  publish commands

---

### Verification

Run after all tasks:
1. `pnpm typecheck`
2. `pnpm build`
3. `pnpm test`
4. `pnpm cdk:synth`
5. Manual deployment smoke against the deployed CloudFront URL or custom
   domain:
   - `/` loads the timeline index
   - direct deep link to `/:jobId` loads correctly
   - `/data/index.json` is served same-origin
   - a missing `/data/*` object returns a real 404
   - timeline audio playback works from CloudFront-served chunk files
