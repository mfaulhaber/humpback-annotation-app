# AWS Static Viewer Publish Design

**Date**: 2026-04-06
**Status**: Draft
**Audience**: Humpback Timeline Viewer contributors

## 1. Summary

This design defines the first AWS publish path for the active humpback
timeline viewer. The target is a low-idle-cost static deployment that keeps
the current runtime model intact:

- the React app is served as a static bundle
- timeline manifests, tiles, and audio stay same-origin under `/data/*`
- no request-time compute is required for the viewer path

The dormant legacy annotation app is intentionally out of scope for this
effort. It remains in the repository for reference, but it is not part of the
AWS publish plan, deployment stack, or release checklist for this design.

For this design, assume the primary deployment region is `us-west-2`.

## 2. Context

The active repository state already points toward a static AWS deployment:

- the frontend builds to a plain Vite bundle under `frontend/dist`
- the active router exposes only `/` and `/:jobId`
- timeline data is fetched directly from `/data/index.json` and
  `/data/{jobId}/manifest.json`
- tile and audio URLs are derived directly from the same-origin `/data/*`
  contract
- the local dev server mounts `TIMELINE_EXPORT_ROOT` at `/data/*` to mirror the
  intended deployed URL shape

The missing pieces are operational rather than product-shape changes:

- the `cdk/` package is still a stub
- there is no AWS stack for buckets, CloudFront, or TLS
- there are no repo-local publish commands for the app bundle or timeline
  export data
- there is no release runbook for static AWS publishing

Because the viewer is already readonly and static-first, the deployment design
should reinforce those properties rather than introduce Lambda, API Gateway,
or Cognito dependencies.

## 3. Goals

This effort should:

1. publish the active timeline viewer to AWS without adding request-time
   compute to the viewer path
2. preserve the existing same-origin `/data/*` contract used by the frontend
3. keep the app deployable at the domain root so the current `BrowserRouter`
   and absolute `/data/*` paths continue to work
4. separate app-bundle publishing from timeline-export publishing so the viewer
   UI and exported datasets can evolve independently
5. define the deployment in repo-local infrastructure code instead of ad hoc
   console setup
6. provide a repeatable manual publish path now, while leaving CI/CD for later

## 4. Non-Goals

Out of scope for this change:

- deploying the legacy annotation API, Lambda adapter, DynamoDB tables, or
  dev-auth flow
- adding Cognito or any other auth requirement for the readonly viewer
- generating timeline export artifacts inside this repository
- changing the manifest, tile, or audio URL contract
- supporting subpath hosting such as `/viewer/*` in the first AWS release
- adding a broader cloud platform for the dormant legacy app

## 5. Approaches Considered

### Approach A: One CloudFront distribution with separate private S3 origins for app and data

Use one CloudFront distribution as the public entry point. Point the default
behavior at a private S3 bucket containing the Vite app bundle and map
`/data/*` to a separate private S3 bucket containing exported timeline
artifacts.

Pros:

- preserves the same-origin runtime contract exactly
- lets app releases and data publishes happen independently
- allows different cache policies for `/index.html`, `/assets/*`, and `/data/*`
- keeps viewer traffic entirely static and CDN-backed
- aligns with the repository's existing low-idle-cost design direction

Cons:

- requires more CDK work than a single-bucket setup
- needs careful SPA fallback behavior so viewer routes work without rewriting
  `/data/*`

### Approach B: One private S3 bucket behind CloudFront for both app and data

Store the app bundle and exported timeline artifacts in a single S3 bucket and
front it with one CloudFront distribution.

Pros:

- simplest infrastructure shape
- one origin to manage
- easiest first deployment story if app and data are always published together

Cons:

- couples app-bundle and data publishing lifecycles
- makes cache policy and lifecycle management less clear
- increases the chance of accidentally mixing mutable app files and large data
  artifacts in one operational bucket

### Approach C: Amplify Hosting for the app bundle plus a separate data bucket

Use Amplify Hosting or a similar static-site service for the React bundle while
continuing to serve `/data/*` from a separate S3-backed path.

Pros:

- convenient frontend hosting workflow
- less initial infrastructure code for the app shell

Cons:

- weakens control over the same-origin `/data/*` contract
- still requires custom handling for export data publishing
- less aligned with the repo's stated CloudFront + S3 deployment direction
- adds platform indirection without solving the core data-path requirements

## 6. Decision

Choose **Approach A**.

It keeps the public runtime simple for the browser while preserving a useful
operational separation between the app bundle and exported timeline data. That
matches the current frontend design, the approved same-origin `/data/*`
contract, and the repo's low-idle-cost deployment goals.

## 7. Proposed Architecture

### 7.1 Public Runtime Shape

```text
Browser
  │
  ▼
CloudFront
  ├─ default behavior            -> private S3 app bucket
  │    - /index.html
  │    - /assets/*
  │    - SPA deep-link fallback for routes like /:jobId
  └─ /data/* behavior            -> private S3 timeline-data bucket
       - /data/index.json
       - /data/{jobId}/manifest.json
       - /data/{jobId}/tiles/*
       - /data/{jobId}/audio/*
```

Key properties:

- both origins stay private behind CloudFront Origin Access Control
- the browser sees one origin, so no CORS changes are needed
- the viewer keeps loading `/data/*` directly without API mediation
- the legacy annotation stack is not deployed as part of this path

### 7.2 Routing Behavior

The current frontend uses `BrowserRouter` and expects to live at the domain
root. The first AWS publish should therefore keep the app root-hosted.

CloudFront must distinguish between three path classes:

1. app shell routes such as `/` and `/:jobId`
2. static app assets such as `/assets/*`
3. timeline data objects under `/data/*`

SPA fallback must apply only to class 1. It must not rewrite `/data/*` misses
or asset misses to `/index.html`, because those should remain true object 404s.

### 7.3 Buckets and Access Model

Use two private S3 buckets:

- `viewer app bucket`
- `timeline data bucket`

Recommended defaults:

- block all public access on both buckets
- allow reads only through CloudFront Origin Access Control
- enable versioning at least on the app bucket; enable on the data bucket if
  export replacement-in-place is expected

This design intentionally keeps the timeline export data outside the app bundle
bucket so dataset publishing does not require republishing the frontend.

### 7.4 TLS and DNS

For a production-facing domain, provision:

- an ACM certificate in `us-east-1`
- a Route 53 alias record pointing to the CloudFront distribution

The stack should still support an AWS-generated CloudFront domain for early
verification when a custom domain is not yet ready.

Regional assumption:

- the main infrastructure stack is deployed in `us-west-2`
- if a custom domain is used with CloudFront, the ACM certificate must still be
  issued in `us-east-1`

### 7.5 Caching Strategy

Cache behavior should reflect file mutability:

- `/index.html`: short TTL or no-cache
- `/assets/*`: long TTL, immutable
- `/data/index.json`: short TTL or explicit invalidation on publish
- `/data/{jobId}/manifest.json`: moderate TTL, with invalidation if rewritten
- `/data/{jobId}/tiles/*` and `/data/{jobId}/audio/*`: long TTL when job
  directories are treated as immutable

Operational assumption:

- published `jobId` directories should preferably be immutable
- if an export must change materially, publish a new job directory instead of
  overwriting tiles or audio in place

That keeps CloudFront caching predictable and avoids stale media surprises.

### 7.6 Publish Model

The release path should separate UI deploys from data publishes.

#### App publish

1. run `pnpm --filter @humpback/frontend build`
2. upload `frontend/dist` to the app bucket
3. set cache headers appropriate for `index.html` versus hashed assets
4. invalidate the minimal CloudFront paths needed for the app release

#### Timeline data publish

1. take a local export root containing `index.json` and job folders
2. upload it into the timeline-data bucket so CloudFront exposes it at `/data/*`
3. invalidate at least `/data/index.json` and any changed manifests when needed

The data publish path should not upload legacy API artifacts, local-media
folders, or anything from the dormant annotation app.

## 8. Implementation Notes

### 8.1 Frontend Impact

For a root-hosted AWS launch, the active viewer likely needs little or no
runtime code change:

- `BrowserRouter` already works for domain-root hosting
- `/data/*` is already hard-coded as a root-relative same-origin path
- the production Vite build already emits a static bundle

Implementation work should therefore focus on infrastructure, publish tooling,
and deployment documentation rather than redesigning the viewer runtime.

### 8.2 Deployment Inputs

The stack and publish commands will need a small set of explicit inputs, such
as:

- AWS account and region
- primary deployment region fixed to `us-west-2`
- CloudFront/domain configuration
- target bucket names or stack outputs
- local export root for `/data/*` publishing

These inputs should be encoded in code or documented env vars rather than left
as implied console knowledge.

### 8.3 Legacy App Boundary

The deployment plan should state clearly that the legacy annotation app is
archived from this AWS publish effort:

- no Lambda deployment
- no API Gateway deployment
- no DynamoDB deployment
- no auth rollout
- no `/api/*` or `/media/*` production path in this release

## 9. Risks and Mitigations

### Risk: SPA fallback accidentally rewrites `/data/*` failures

Mitigation:

- use a dedicated CloudFront behavior for `/data/*`
- keep SPA rewrite logic limited to non-file app-shell routes

### Risk: stale data after overwriting exports in place

Mitigation:

- prefer immutable `jobId` directories
- keep `index.json` and manifest invalidations explicit in the publish flow

### Risk: release process becomes app-data coupled again

Mitigation:

- maintain separate publish commands and documentation for app and data
- keep app and data in separate buckets even though the browser sees one origin

### Risk: hidden assumptions about root hosting surface late

Mitigation:

- document that the first AWS release is domain-root only
- treat subpath hosting as a follow-up feature, not an implicit promise

## 10. Validation

The AWS publish path should be considered ready when:

1. `pnpm cdk:synth` emits the CloudFormation for the static viewer stack
2. the built app is reachable at a CloudFront URL or custom domain
3. `/` loads the timeline registry from `/data/index.json`
4. a direct deep link to `/:jobId` loads without a manual redirect
5. `/data/*` 404s remain real 404s instead of returning the SPA shell
6. timeline audio playback works against CloudFront-served chunk files
7. the deployment runbook explicitly excludes the legacy annotation stack

## 11. Assumptions

- The first AWS release will host the viewer at the domain root.
- Timeline export artifacts are available from an external export process.
- The primary infrastructure deployment region is `us-west-2`.
- A CloudFront custom-domain certificate, if used, is the one deliberate
  regional exception and must still live in `us-east-1`.
- Keeping the legacy annotation app out of deployment scope is intentional, not
  temporary ambiguity.
