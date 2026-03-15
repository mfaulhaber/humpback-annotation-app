# DynamoDB Schema Design --- Whale Annotation App

## Overview

The schema is optimized for the actual query patterns of the application
rather than strict normalization.

Two tables are used:

-   Catalog
-   Labels

This keeps browsing logic separate from annotation logic and simplifies
reasoning, development, and reporting.

------------------------------------------------------------------------

# Table 1: Catalog

Stores folders and samples.

Purpose:

-   browse folders
-   list samples in folder
-   fetch sample detail
-   support suggestion candidate selection

Primary key:

PK = pk\
SK = sk

------------------------------------------------------------------------

## Item Type: Folder

PK = FOLDER#{folder_id}\
SK = META

Example:

{ "pk": "FOLDER#north-2026-03-14", "sk": "META", "entity": "Folder",
"folder_id": "north-2026-03-14", "name": "North Hydrophone -
2026-03-14", "description": "Daily browse set", "sample_count": 18342,
"created_at": "2026-03-14T00:00:00Z" }

------------------------------------------------------------------------

## GSI1: Folders by Entity Type

GSI1PK = gsi1pk (entity type, e.g. `"Folder"`)\
GSI1SK = gsi1sk (e.g. `FOLDER#{folder_id}`)

Allows:

-   listing all folders efficiently via query instead of scan

Folder items include `gsi1pk: "Folder"` and `gsi1sk: "FOLDER#{folder_id}"`.

------------------------------------------------------------------------

## Item Type: Sample Reference (for browsing)

PK = FOLDER#{folder_id}\
SK = SAMPLE#{timestamp}#{sample_id}

Example:

{ "pk": "FOLDER#north-2026-03-14", "sk":
"SAMPLE#2026-03-14T08:15:32Z#sample_abc123", "entity": "SampleRef",
"sample_id": "sample_abc123", "captured_at": "2026-03-14T08:15:32Z",
"audio_key": "samples/2026/03/14/sample_abc123.flac", "spectrogram_key":
"spectrograms/2026/03/14/sample_abc123.png", "duration_sec": 5,
"is_active": true }

Purpose:

-   efficient paginated browsing
-   stable time ordering

------------------------------------------------------------------------

## Item Type: Sample Detail

PK = SAMPLE#{sample_id}\
SK = META

Example:

{ "pk": "SAMPLE#sample_abc123", "sk": "META", "entity": "Sample",
"sample_id": "sample_abc123", "folder_id": "north-2026-03-14",
"source_recording_id": "rec_9981", "captured_at":
"2026-03-14T08:15:32Z", "audio_key":
"samples/2026/03/14/sample_abc123.flac", "spectrogram_key":
"spectrograms/2026/03/14/sample_abc123.png", "duration_sec": 5,
"is_active": true }

------------------------------------------------------------------------

# Table 2: Labels

Stores annotation state and aggregates.

Purpose:

-   user labels
-   sample aggregates
-   admin reporting

Primary key:

PK = pk\
SK = sk

------------------------------------------------------------------------

## Item Type: User Sample Label

PK = USER#{user_id}\
SK = LABEL#{sample_id}

Example:

{ "pk": "USER#u_123", "sk": "LABEL#sample_abc123", "entity":
"UserSampleLabel", "user_id": "u_123", "sample_id": "sample_abc123",
"folder_id": "north-2026-03-14", "label_category": "PulsedCall",
"submitted_at": "2026-03-14T20:11:03Z", "updated_at":
"2026-03-14T20:11:03Z" }

Constraint:

Unique per (user_id, sample_id).

Purpose:

-   determine if user labeled a sample
-   labeled/unlabeled filters
-   admin reports by user

------------------------------------------------------------------------

## GSI1: Labels by Sample

GSI1PK = SAMPLE#{sample_id}\
GSI1SK = USER#{user_id}

Allows:

-   listing all labels for a sample
-   rebuilding aggregates if required

------------------------------------------------------------------------

## GSI2: Labels by Folder / Date

GSI2PK = FOLDER#{folder_id}\
GSI2SK = {updated_at}#USER#{user_id}#SAMPLE#{sample_id}

Allows:

-   admin reports by folder
-   date range filtering

------------------------------------------------------------------------

## Item Type: Sample Aggregate

PK = SAMPLE#{sample_id}\
SK = AGGREGATE

Example:

{ "pk": "SAMPLE#sample_abc123", "sk": "AGGREGATE", "entity":
"SampleAggregate", "sample_id": "sample_abc123", "total_labels": 7,
"counts_by_category": { "PulsedCall": 4, "Whistle": 2, "Other": 1 },
"updated_at": "2026-03-14T20:11:03Z" }

Percentages are calculated in the API response rather than stored.

------------------------------------------------------------------------

# Label Write Logic

Case A: First Label

1.  Create UserSampleLabel item
2.  Increment aggregate count for category
3.  Increment total_labels

Case B: Relabel

1.  Read existing label
2.  Update UserSampleLabel
3.  Decrement previous category count
4.  Increment new category count

Both operations should be treated as a single logical transaction.

------------------------------------------------------------------------

# Suggest-Next Strategy

To suggest an unlabeled sample:

1.  Query samples in folder
2.  Batch-check user label existence
3.  Return random unlabeled candidate

This avoids expensive secondary indexes.

------------------------------------------------------------------------

# Capacity Mode

Use **On-Demand capacity** for both tables.

Benefits:

-   minimal idle cost
-   automatic scaling
-   suitable for unpredictable annotation bursts

------------------------------------------------------------------------

# Design Principles

The schema intentionally:

-   separates catalog data from annotation state
-   stores aggregates explicitly for fast reads
-   avoids unnecessary indexes
-   derives percentages dynamically
