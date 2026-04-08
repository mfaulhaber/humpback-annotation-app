# Session Deploy Workflow Design

**Date**: 2026-04-07
**Status**: Accepted
**Audience**: Humpback Timeline Viewer contributors

## 1. Summary

Add a manual `session-deploy` workflow command for the active viewer-only AWS
path. The command should help an operator deploy or redeploy the CDK stack and
publish the current viewer assets without making them remember the full
decision tree each time.

The workflow should be smart enough to:

- detect whether the CloudFormation stack already exists
- run the right CDK step for the current state instead of always redeploying
- resolve the deployed bucket and CloudFront outputs automatically
- verify that the deployed data bucket matches the local export root after the
  app publish step, while leaving export-data upload or sync as a separate
  operator responsibility

`session-deploy` is an optional operational workflow. It is not a new default
phase that runs on every task.

## 2. Context

The repository already has the low-level pieces for AWS publishing:

- `pnpm cdk:synth`
- `pnpm cdk:diff`
- `pnpm cdk:deploy`
- `pnpm publish:viewer:app`
- `pnpm publish:viewer:data`
- `pnpm upload:viewer:missing`

Those commands are enough for an experienced operator, but they still require
manual judgment:

- first deploy versus redeploy is not detected automatically
- stack outputs must still be gathered and threaded into publish commands
- there is no repo-local workflow command that explains the safe order of
  operations
- there is no built-in check for whether the deployed data bucket still matches
  the local export root that the operator intends to publish

This makes deployment easy to do inconsistently, especially when the app bundle
is redeployed but the timeline export data in S3 has drifted away from the
local export root the operator expects to be live.

## 3. Goals

This effort should:

1. add a manual `session-deploy` workflow command mirrored in
   `docs/workflows/` and `.claude/commands/`
2. keep the workflow focused on the active viewer-only CloudFront/S3 stack
3. choose the right CDK action based on real AWS state:
   - first deploy if the stack does not exist
   - diff and deploy only when the stack exists and infrastructure has changed
4. resolve stack outputs automatically instead of requiring manual copy/paste
   into follow-on publish commands
5. publish the frontend bundle after infrastructure is ready
6. verify that the deployed data bucket matches the local export root and fail
   with actionable drift details when it does not
7. provide a dry-run mode that reports what would happen before changing AWS
8. keep export-data upload or sync outside `session-deploy`; operators should
   run explicit data publish or sync commands themselves when needed
9. keep the dormant annotation API, DynamoDB tables, auth flow, and local media
   assets out of deploy scope

## 4. Non-Goals

Out of scope for the first `session-deploy` version:

- generating timeline export artifacts from raw source data
- turning deployment into automatic CI/CD
- deploying the dormant legacy annotation stack
- inventing a second publish path parallel to the existing viewer publish
  scripts
- automatically uploading or deleting timeline export data as part of
  `session-deploy`
- perfect remote diffing for every tile and audio object in already-published
  jobs beyond the parity checks needed to detect drift

The initial data-smartness only needs to solve the concrete operator problem of
"does the deployed bucket still match the local export root I expect to be
live?"

## 5. Approaches Considered

### Approach A: Documentation-only workflow with manual command composition

Add `session-deploy` as a runbook that tells the operator when to run
`pnpm cdk:synth`, `pnpm cdk:diff`, `pnpm cdk:deploy`,
`pnpm publish:viewer:app`, and either `pnpm publish:viewer:data` or
`pnpm upload:viewer:missing`.

Pros:

- smallest implementation
- no new deploy automation logic
- low code risk

Cons:

- still relies on human judgment for stack existence and follow-up steps
- still requires manually wiring stack outputs into publish commands
- does not solve the "is the deployed bucket actually in sync with local data"
  validation request

### Approach B: Workflow command plus a smart deploy helper script

Add `session-deploy` as an operator workflow backed by a repo-local helper
script. The script inspects CloudFormation and S3 state, chooses the needed CDK
step, resolves outputs, always publishes the app bundle after infrastructure is
ready, and validates export-data parity so the workflow fails when the deployed
bucket has drifted from the local export root.

Pros:

- fulfills the request for a smart, manual deploy command
- keeps the release process repo-local and repeatable
- avoids forcing the operator to re-enter bucket names and distribution IDs
- keeps the implementation bounded by reusing the existing publish commands
  without folding manual data sync into the deploy helper

Cons:

- adds AWS-inspection logic to the `scripts/` workspace
- needs careful reporting so skipped versus executed steps are obvious
- verification failures may require manual S3 reconciliation before a deploy can
  be considered complete

### Approach C: Full remote release-state manifests for both app and data

Extend the publish path to write structured release-state objects into S3 so
`session-deploy` can compare the current git revision and export fingerprints
against the last deployed release with near-perfect precision.

Pros:

- most precise skip logic
- strongest base for future CI/CD
- could later support deployment audits

Cons:

- much larger scope than the current operator need
- adds new state contracts that must stay backwards-compatible
- increases implementation and debugging complexity

## 6. Decision

Choose **Approach B**.

It is the best fit for the requested behavior without turning this into a
full release-management system. The key idea is:

- be precise about infrastructure changes by checking real stack state and CDK
  diff output
- be practical about app publishing by making it a normal follow-up after the
  infrastructure is ready
- be smart about export data by validating that the deployed bucket still
  matches the local export root, while leaving sync operations explicit and
  manual

This keeps the first version useful and understandable while leaving room for a
future release-state manifest if the deployment workflow becomes more complex.

## 7. Proposed Workflow

### 7.1 Operator Model

`session-deploy` is invoked manually by the user when they want to deploy or
redeploy the active viewer stack. It should operate on the currently checked
out revision, not invent a release branch or merge flow.

Safety expectations:

- prefer a clean working tree
- stop on detached `HEAD`
- if the tree is dirty, warn and stop unless the user explicitly wants to
  deploy uncommitted changes

That keeps deployment decisions deliberate.

### 7.2 Decision Flow

The workflow should execute this sequence:

1. Validate deploy inputs:
   - AWS credentials available
   - `STATIC_VIEWER_STACK_NAME` and related deploy env loaded from shell or
     `.env.deploy`
   - `TIMELINE_EXPORT_ROOT` or `--path` available when data verification is
     expected
2. Query CloudFormation for the configured stack name.
3. Run `pnpm cdk:synth` as a baseline validation step.
4. If the stack does not exist:
   - run `pnpm cdk:deploy`
5. If the stack already exists:
   - run a machine-checkable CDK diff
   - if infrastructure changed, run `pnpm cdk:deploy`
   - otherwise skip deploy and report that the stack is already current
6. Read the deployed stack outputs for:
   - app bucket name
   - data bucket name
   - CloudFront distribution ID
7. Publish the frontend bundle using the resolved outputs.
8. Inspect the local export root and remote data bucket:
   - fail if a local object is missing remotely
   - fail if a remote object exists that is not present locally
   - fail if object sizes differ
   - fail if JSON files differ in content after normalization
   - otherwise report that data verification passed
9. Print a concise summary of what ran, what was skipped, and the resulting
   public URLs or stack identifiers.

### 7.3 Data Verification Heuristic

The first version should optimize for explicit parity validation rather than an
automatic repair flow.

Recommended heuristic:

- walk the local export root and the remote data bucket using the same relative
  key space
- compare key presence in both directions so missing and extra remote objects
  are surfaced
- compare object sizes for all tracked files
- compare normalized JSON content for JSON files so metadata drift is caught
  even when formatting differs

This catches:

- missing remote objects
- extra remote objects
- changed index or manifest metadata
- size or content drift within an already published job

It intentionally does not attempt to repair drift automatically. Operators
should use explicit sync or publish commands when the verification fails.

### 7.4 Flags and Reporting

The helper should support at least:

- `--dry-run` to print the deploy plan without mutating AWS
- `--path <export-root>` to override `TIMELINE_EXPORT_ROOT`
- `--skip-data` for infrastructure or app-only deploys

Operator output should clearly distinguish:

- `cdk deploy: ran/skipped`
- `app publish: ran/skipped`
- `data verification: ran/skipped/failed`

Each skipped step should include a short reason.

### 7.5 Failure Behavior

The workflow should fail fast when:

- required AWS environment variables are missing
- the configured stack exists but required outputs are absent
- the local export root is requested but malformed
- CDK synth, diff, deploy, or publish commands fail
- data verification detects missing, extra, or mismatched objects

It should not partially hide failure by continuing after a broken prerequisite.

## 8. Repository Impact

Expected implementation areas:

- `docs/workflows/session-deploy.md` for the operator workflow
- `.claude/commands/session-deploy.md` for the command mirror
- `scripts/` for the smart deploy helper and AWS inspection utilities
- `README.md`, `CLAUDE.md`, and `AGENTS.md` for command inventory and operator
  guidance

The existing low-level publish commands should remain available. `session-deploy`
should orchestrate them rather than replace them.

## 9. Verification Strategy

Implementation should verify:

- `pnpm typecheck`
- `pnpm build`
- a dry-run of the smart deploy helper against a configured environment
- at least one manual smoke of:
  - stack-missing path or diff-detected deploy path
  - no-infra-change path
  - data verification failure when the deployed bucket drifts from local
  - data verification pass when local and deployed data are in sync

`pnpm test` is not automatically required unless the implementation adds or
touches covered frontend logic. `pnpm test:legacy` is not relevant unless the
legacy dormant stack is touched, which this design should avoid.
