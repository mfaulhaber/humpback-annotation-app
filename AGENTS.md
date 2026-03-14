# Humpback Annotation App — Agent Instructions

This is the entry point for Codex and other agents. `CLAUDE.md` is the
authoritative spec for repository rules and current architecture guidance.

## Key Constraints

- This repository is currently design-first. Do not describe planned systems as
  already implemented.
- Keep the V1 architecture aligned with the existing design docs unless a new
  decision is recorded in `DECISIONS.md`.
- Media delivery should remain CDN/object-storage based; application APIs should
  return media URLs rather than proxying bytes.
- Preserve the core annotation rule: one current label per sample per user.
- Aggregate percentages must remain hidden until the current user has submitted
  a label for that sample.
- When architecture, workflows, data models, or project status change, update
  the relevant memory files in the same change.

## Memory Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Behavioral rules, architecture guardrails, and repo expectations |
| `MEMORY.md` | Stable reference material: entities, DynamoDB schema, flows, local dev stack |
| `DECISIONS.md` | Append-only architecture decision log |
| `STATUS.md` | Current repo state and implemented-vs-planned reality |
| `PLANS.md` | Active and upcoming work |

## Session Start

Before coding, read `STATUS.md`, `PLANS.md`, and `DECISIONS.md` for current
state and open work. Read `MEMORY.md` when working on the data model, API
shape, query patterns, or local development workflow. Read `CLAUDE.md` for
overall rules.
