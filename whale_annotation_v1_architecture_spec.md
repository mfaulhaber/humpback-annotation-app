# Whale Annotation App --- V1 Architecture Spec

## 1. Goals

Build a low-cost serverless web application for registered users to:

-   browse whale vocalization samples
-   preview 5‑second audio clips
-   view static spectrogram images
-   apply one label per sample per user
-   see aggregate label percentages only after submitting their own
    label
-   browse by folder and filter by labeled/unlabeled
-   optionally request a suggested next unlabeled sample

The system should:

-   minimize idle cost above all else
-   deliver acceptable west‑coast UX (\~500--1000 ms)
-   use object storage as source of record for media
-   run locally for development without requiring cloud deployment
-   deploy to cloud infrastructure via infrastructure-as-code

------------------------------------------------------------------------

## 2. Non‑Goals (V1)

Out of scope for the initial release:

-   dynamic spectrogram generation
-   global multi‑region performance optimization
-   task assignment workflow
-   consensus enforcement workflow
-   immutable audit log / rollback system
-   user quality scoring
-   dispute resolution workflows
-   gold‑standard samples
-   complex search platform
-   relational database dependency
-   application-level media caching layer

------------------------------------------------------------------------

## 3. Actors and Permissions

### Annotator

Can: - sign in - browse folders and samples - filter samples by
labeled/unlabeled - preview audio and spectrogram - submit/update their
own label - view aggregate percentages only **after labeling** - request
suggested next unlabeled sample

Cannot: - view admin reporting - inspect other users' raw labels

### Admin

Can: - perform all annotator actions - view labels filtered by
user/sample/folder/category/date - export reporting data

------------------------------------------------------------------------

## 4. Product Rules

1.  **One current label per sample per user**
2.  **Aggregate percentages hidden until user submits label**
3.  **Users may freely browse samples**
4.  **System may suggest next unlabeled sample**
5.  **Media files are public**
6.  **Spectrograms are pre-rendered images**

------------------------------------------------------------------------

## 5. High-Level Architecture

Browser → CDN → Static web app → Public audio clips → Public spectrogram
images

Browser → Authenticated API → Catalog service → Annotation service →
Suggest-next service → Admin reporting service

Services → Catalog datastore → Label datastore → Identity/authentication
system

------------------------------------------------------------------------

## 6. Core Entities

### Folder

-   folder_id
-   name
-   description
-   sample_count
-   created_at

### Sample

-   sample_id
-   folder_id
-   source_recording_id
-   captured_at
-   audio_key
-   spectrogram_key
-   duration_sec
-   is_active

### User

-   user_id
-   display_name
-   role
-   status
-   created_at

### UserSampleLabel

-   sample_id
-   user_id
-   label_category
-   submitted_at
-   updated_at

Constraint: unique (sample_id, user_id)

### SampleAggregate

-   sample_id
-   total_labels
-   counts_by_category
-   percentages_by_category
-   updated_at

------------------------------------------------------------------------

## 7. Main Request Flows

### Browse folders

Client → API → Catalog → Client

### Browse samples

Client → API → Catalog + Label state → Client

### Open sample before labeling

Client → API → Catalog + user label → Client\
Client → CDN → Media files

### Submit label

Client → API\
API updates user label\
API updates sample aggregate\
API returns updated percentages

### Suggest next unlabeled sample

Client → API → catalog + label state → Client

### Admin reporting

Admin → API → label datastore → results

------------------------------------------------------------------------

## 8. API Surface (Conceptual)

Catalog: - GET /folders - GET /folders/{folderId}/samples - GET
/samples/{sampleId} - GET /samples/suggest-next

Annotation: - PUT /samples/{sampleId}/label

Admin: - GET /admin/labels

------------------------------------------------------------------------

## 9. Media Delivery Strategy

Media files (audio + spectrogram PNG) are served directly from
CDN-backed object storage.

Compute services never proxy media bytes.

Benefits: - lowest cost - lowest latency - minimal compute usage

------------------------------------------------------------------------

## 10. Performance Strategy

To meet the 500--1000 ms target:

-   precompute media artifacts
-   paginate sample lists
-   keep API payloads small
-   store aggregate label counts directly
-   return aggregates immediately after label submission

------------------------------------------------------------------------

## 11. Suggest‑Next Strategy

Purpose: reduce uneven labeling coverage.

V1 algorithm options: - random unlabeled sample in current folder - next
unlabeled sample by sort order

------------------------------------------------------------------------

## 12. Reporting Model

Reporting supports filtering labels by:

-   user
-   folder
-   sample
-   category
-   date range

Only **current label state** is stored in V1.

------------------------------------------------------------------------

## 13. Risks

-   aggregate counts must stay consistent with label updates
-   folder browsing must remain paginated
-   free browse may produce uneven coverage (suggest‑next mitigates)

------------------------------------------------------------------------

## 14. Next Design Step

Next documentation layer will define:

-   component architecture diagram
-   datastore query patterns
-   API contract structure
-   consistency model for label + aggregate updates
-   local vs cloud environment boundaries
