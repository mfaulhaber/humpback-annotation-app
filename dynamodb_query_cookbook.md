# Legacy DynamoDB Query Cookbook for the Shelved Annotation Stack

> Status: Historical query reference for the shelved annotation backend. The
> active product in this repository is the timeline viewer; use this document
> only when intentionally working on the dormant annotation/API path.

This cookbook documents the exact DynamoDB access patterns used by the Whale Annotation App backend.

Tables:
- Catalog
- Labels

Key design principles:
- Media delivery never touches compute
- Catalog browsing and annotation state are separated
- Aggregates are stored to avoid recomputation
- Percentages are calculated in the API layer

---

# 1. GET /folders

Goal: list all folders.

Table: Catalog
Index: GSI1

Query:

KeyCondition:
    gsi1pk = ENTITY#FOLDER

Return fields:
- folder_id
- name
- description
- sample_count
- created_at

Pagination:
Use LastEvaluatedKey.

---

# 2. GET /folders/{id}/samples

Goal: browse samples in a folder.

Tables used:
- Catalog
- Labels

Step 1 — Query catalog

Table: Catalog
PK = FOLDER#{folder_id}
SK begins_with SAMPLE#

Limit: internal_scan_page_size
ExclusiveStartKey: cursor

Step 2 — BatchGet user label state

Keys:
PK = USER#{user_id}
SK = LABEL#{sample_id}

Step 3 — Merge results

For each sample:
if label row exists → labeled
else → unlabeled

Step 4 — Apply filter

filter=all → return all  
filter=labeled → return labeled only  
filter=unlabeled → return unlabeled only

Pagination rule:

Continue scanning catalog pages until
response_page_size is filled or folder exhausted.

---

# 3. GET /samples/{sampleId}

Goal: fetch sample detail.

Step 1 — Read sample

Catalog.GetItem
PK = SAMPLE#{sample_id}
SK = META

Step 2 — Read user label

Labels.GetItem
PK = USER#{user_id}
SK = LABEL#{sample_id}

Step 3 — Conditional aggregate read

If user labeled sample:

Labels.GetItem
PK = SAMPLE#{sample_id}
SK = AGGREGATE

Return:
- sample metadata
- user label
- aggregate (if allowed)

Percentages calculated in API.

---

# 4. PUT /samples/{sampleId}/label

Goal: create or update label.

Steps:

1. Validate sample exists
2. Read current user label
3. Determine case

Case A — first label
Case B — same label (no-op)
Case C — relabel

Transaction operations:

Insert or update label row
Update aggregate counts

Aggregate updates:

First label:
- increment total_labels
- increment category count

Relabel:
- decrement old category
- increment new category

Use TransactWriteItems.

After write:

Read aggregate and compute percentages.

---

# 5. GET /samples/suggest-next

Goal: suggest one unlabeled sample.

Algorithm:

1. Query sample page from folder
2. Batch-get label rows for user
3. Filter unlabeled samples
4. Choose one candidate

Pseudo-random start position recommended
to avoid bias toward early samples.

---

# 6. GET /admin/labels?userId=

Goal: list labels by user.

Table: Labels

Query:

PK = USER#{user_id}
SK begins_with LABEL#

---

# 7. GET /admin/labels?sampleId=

Goal: list labels for a sample.

Index: Labels.GSI1

Query:

GSI1PK = SAMPLE#{sample_id}

---

# 8. GET /admin/labels?folderId=&from=&to=

Goal: folder reporting.

Index: Labels.GSI2

Query:

GSI2PK = FOLDER#{folder_id}
GSI2SK between {from} and {to}

---

# 9. Aggregate rebuild

Goal: recompute counts for one sample.

Query:

Labels.GSI1
GSI1PK = SAMPLE#{sample_id}

Steps:

1. Fetch all label rows
2. Count by category
3. Update aggregate item

PK = SAMPLE#{sample_id}
SK = AGGREGATE

---

# 10. Pagination

All list endpoints use DynamoDB LastEvaluatedKey cursors.

Client should treat cursors as opaque values.

---

# 11. Transaction Best Practices

Use TransactWriteItems for:

- first label writes
- relabel operations

Keep transactions small:
- label row
- aggregate row

---

# 12. Batch Operations

BatchGetItem used for:
- resolving label state during browsing

Handle unprocessed keys with retries.

---

# 13. Design Summary

The query model separates workloads:

Media delivery → CDN  
Catalog browsing → Catalog table  
Annotation state → Labels table

This separation minimizes cost and simplifies scaling.
