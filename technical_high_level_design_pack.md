
# Technical High-Level Design Pack

## 1. Scope

This document translates the V1 architecture spec into an implementation-ready high-level system design while still avoiding framework-specific decisions.

It focuses on:

- component architecture
- data access patterns
- API interaction model
- aggregate consistency strategy
- local vs cloud runtime boundaries
- operational cost profile

---

## 2. Component Architecture

```text
                         ┌───────────────────────┐
                         │       Browser         │
                         │       Web UI          │
                         └──────────┬────────────┘
                                    │
                           HTTPS (static + media)
                                    │
                          ┌─────────▼─────────┐
                          │       CDN         │
                          │ Static + Media    │
                          └───────┬───────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
            ┌───────▼────────┐          ┌───────▼─────────┐
            │  Web App Store │          │   Media Store   │
            │ static assets  │          │ audio + images  │
            └────────────────┘          └─────────────────┘


Browser (authenticated calls)
        │
        ▼
┌───────────────────────────────┐
│           API Layer           │
└─────────────┬─────────────────┘
              │
     ┌────────┼─────────┬────────────┐
     ▼        ▼         ▼            ▼
Catalog   Annotation  Suggest   Admin/Report
Service    Service     Service      Service

              │
              ▼
       ┌─────────────┐
       │ Data Layer  │
       │             │
       │ Catalog DB  │
       │ Labels DB   │
       │ User Auth   │
       └─────────────┘
```

Key property:

- media path never touches compute
- only metadata and annotation flows go through services

---

## 3. Data Access Patterns

The schema must support four primary query classes.

### Pattern 1 — Folder browse

Query:

- list samples by folder

Used for:

- `GET /folders/{id}/samples`

Returned fields:

- `sample_id`
- `timestamp`
- `spectrogram_url`
- `audio_url`
- `is_labeled_by_user`

The label state must be joined per user.

### Pattern 2 — Sample detail

Query:

- fetch sample metadata
- fetch user label state
- if labeled, fetch sample aggregate

### Pattern 3 — Submit label

Operations:

- upsert `UserSampleLabel`
- update `SampleAggregate`

Constraint:

- `(sample_id, user_id)` unique

Aggregate update must:

- increment new category
- decrement old category if the label changed

### Pattern 4 — Admin reporting

Queries supported:

- labels by user
- labels by sample
- labels by folder
- labels by category
- labels by date range

These queries should not require aggregate recomputation.

---

## 4. Label + Aggregate Consistency Strategy

The system maintains two records:

- `UserSampleLabel`
- `SampleAggregate`

### Write logic

Case A — first label

- insert `UserSampleLabel`
- increment aggregate for category
- increment aggregate total

Case B — label change

- read previous label
- update `UserSampleLabel`
- decrement old category
- increment new category

Atomicity requirement:

- both updates should be treated as one logical operation

At this scale, contention risk is extremely low.

---

## 5. API Interaction Model

### Browse Flow

- client calls API to list samples
- client loads spectrograms from CDN
- client loads audio from CDN

Important principle:

- API never returns media bytes
- API returns URLs only

### Label Flow

- user selects category
- client sends label
- API validates
- API writes label
- API updates aggregate
- API returns new percentages

Response shape:

```json
{
  "sampleId": "sample-123",
  "userLabel": "PulsedCall",
  "aggregate": {
    "totalLabels": 9,
    "percentagesByCategory": {
      "PulsedCall": 66.7,
      "Whistle": 22.2,
      "Other": 11.1
    }
  }
}
```

### Suggest Next Flow

- client requests suggestion
- API selects unlabeled sample
- API returns sample ID

V1 algorithm:

- random unlabeled sample within folder scope

Possible later refinements:

- least labeled sample
- coverage balancing
- difficulty ranking

---

## 6. Local Development Architecture

Local runtime should not require cloud infrastructure.

```text
Local Browser
     │
Local Web App
     │
Local API Server
     │
Local Dev Database
     │
Local Media Folder
```

Media keys should resolve to:

- local filesystem, or
- local dev object store

This allows full application runs locally.

Infrastructure-as-code should only control cloud deployment.

---

## 7. Deployment Architecture

Cloud deployment provisions:

- CDN
- web asset storage
- media storage
- API gateway
- compute functions
- data stores
- user authentication

The deployment definition should support:

- dev
- staging
- prod

But local development remains environment-independent.

---

## 8. Expected Load Profile

### Users

- 25–50 registered
- 2–5 concurrent

### Data

- 10,000–20,000 samples/day

### Label traffic

- 500–1000 labels/day

This is a very small write workload.

The dominant footprint is media storage, not annotation data.

---

## 9. Cost Drivers

Primary cost categories:

### Storage

- audio clips
- spectrogram images

### CDN bandwidth

- spectrogram previews
- audio playback

### API calls

- very small

### Database reads/writes

- also very small

Conclusion:

- media delivery dominates cost

---

## 10. Operational Observability

Minimal monitoring is sufficient.

Important metrics:

- label submission errors
- aggregate update failures
- API latency
- suggestion query latency

Optional metrics:

- label distribution per category
- per-user labeling rate
- folder coverage

---

## 11. Failure Modes

### Aggregate mismatch

Cause:

- failed aggregate update

Mitigation:

- periodic aggregate rebuild job

This is feasible because labels per sample are small.

### Partial writes

Mitigation:

- transactional update

### CDN stale objects

Mitigation:

- versioned media keys

---

## 12. Future Extensions

The design leaves room for:

- label history via a `LabelEvent` table
- inter-annotator agreement scoring
- task assignment
- model-assisted labeling
- active learning loops

---

## 13. Core Design Principle

The system works because it separates three workloads:

- media delivery
- annotation writes
- catalog browsing

Each has:

- different scaling characteristics
- different latency requirements
- different cost profiles

Keeping them separate prevents complexity creep.
