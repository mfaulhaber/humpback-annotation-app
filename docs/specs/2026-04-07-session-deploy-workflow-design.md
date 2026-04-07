# Session Deploy Workflow Design

**Date**: 2026-04-07
**Status**: Draft
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
- publish timeline export data when the local export root includes detection
  jobs that are not present in the deployed data bucket

`session-deploy` is an optional operational workflow. It is not a new default
phase that runs on every task.

## 2. Context

The repository already has the low-level pieces for AWS publishing:

- `pnpm cdk:synth`
- `pnpm cdk:diff`
- `pnpm cdk:deploy`
- `pnpm publish:viewer:app`
- `pnpm publish:viewer:data`

Those commands are enough for an experienced operator, but they still require
manual judgment:

- first deploy versus redeploy is not detected automatically
- stack outputs must still be gathered and threaded into publish commands
- there is no repo-local workflow command that explains the safe order of
  operations
- there is no built-in check for whether the local export root contains a new
  detection job that should be uploaded

This makes deployment easy to do inconsistently, especially after a new export
job is added locally but before anyone remembers to publish it.

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
6. publish timeline export data when the local export root has unpublished
   detection jobs or when the remote data index is missing or outdated
7. provide a dry-run mode that reports what would happen before changing AWS
8. keep the dormant annotation API, DynamoDB tables, auth flow, and local media
   assets out of deploy scope

## 4. Non-Goals

Out of scope for the first `session-deploy` version:

- generating timeline export artifacts from raw source data
- turning deployment into automatic CI/CD
- deploying the dormant legacy annotation stack
- inventing a second publish path parallel to the existing viewer publish
  scripts
- perfect remote diffing for every tile and audio object in already-published
  jobs

The initial data-smartness only needs to solve the concrete operator problem of
"a new detection job exists locally and should be published."

## 5. Approaches Considered

### Approach A: Documentation-only workflow with manual command composition

Add `session-deploy` as a runbook that tells the operator when to run
`pnpm cdk:synth`, `pnpm cdk:diff`, `pnpm cdk:deploy`,
`pnpm publish:viewer:app`, and `pnpm publish:viewer:data`.

Pros:

- smallest implementation
- no new deploy automation logic
- low code risk

Cons:

- still relies on human judgment for stack existence and follow-up steps
- still requires manually wiring stack outputs into publish commands
- does not solve the "new local detection job" detection request

### Approach B: Workflow command plus a smart deploy helper script

Add `session-deploy` as an operator workflow backed by a repo-local helper
script. The script inspects CloudFormation and S3 state, chooses the needed CDK
step, resolves outputs, always publishes the app bundle after infrastructure is
ready, and conditionally publishes export data when local jobs are missing
remotely or the remote index is absent or changed.

Pros:

- fulfills the request for a smart, manual deploy command
- keeps the release process repo-local and repeatable
- avoids forcing the operator to re-enter bucket names and distribution IDs
- keeps the implementation bounded by reusing the existing publish commands

Cons:

- adds AWS-inspection logic to the `scripts/` workspace
- needs careful reporting so skipped versus executed steps are obvious
- app publishes may still run more often than strictly necessary

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
- be smart about export data by checking whether the local export root contains
  jobs that are not already deployed

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
   - `TIMELINE_EXPORT_ROOT` or `--path` available when data publishing is
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
   - if remote `index.json` is missing, publish data
   - if local `index.json` differs from remote, publish data
   - if any local job from the export root is missing a remote
     `<jobId>/manifest.json`, publish data
   - otherwise skip data publish and explain why
9. Print a concise summary of what ran, what was skipped, and the resulting
   public URLs or stack identifiers.

### 7.3 Data Publish Heuristic

The first version should optimize for the local "new detection job" case rather
than a perfect deep object diff.

Recommended heuristic:

- treat local `index.json` as the source of truth for expected jobs
- verify each local job has a local `manifest.json`
- compare the local jobs against remote manifest presence in the data bucket
- compare local `index.json` against the remote `index.json`

This catches:

- first-time data publish
- newly added detection jobs
- changed index metadata

It intentionally does not attempt to diff every remote tile or audio object for
previously published jobs. For those cases, the workflow should support a force
flag such as `--force-data`.

### 7.4 Flags and Reporting

The helper should support at least:

- `--dry-run` to print the deploy plan without mutating AWS
- `--path <export-root>` to override `TIMELINE_EXPORT_ROOT`
- `--force-data` to publish export data even when the heuristic sees no new
  jobs
- `--skip-data` for infrastructure or app-only deploys

Operator output should clearly distinguish:

- `cdk deploy: ran/skipped`
- `app publish: ran/skipped`
- `data publish: ran/skipped`

Each skipped step should include a short reason.

### 7.5 Failure Behavior

The workflow should fail fast when:

- required AWS environment variables are missing
- the configured stack exists but required outputs are absent
- the local export root is requested but malformed
- CDK synth, diff, deploy, or publish commands fail

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
  - export-data publish trigger when a local job is absent remotely

`pnpm test` is not automatically required unless the implementation adds or
touches covered frontend logic. `pnpm test:legacy` is not relevant unless the
legacy dormant stack is touched, which this design should avoid.
