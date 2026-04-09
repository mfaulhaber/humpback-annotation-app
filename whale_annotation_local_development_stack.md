# Shelved Whale Annotation App — Local Development Stack

> Status: Historical documentation for the shelved annotation stack. The active
> product in this repository is the timeline viewer described in `README.md`
> and `CLAUDE.md`, and parts of this document predate the current viewer-first
> local-development workflow.

## 1. Goals

The local development environment should:

- run the full application without AWS
- allow fast iterative development
- mirror the production architecture where possible
- allow testing Lambda handlers locally
- allow testing DynamoDB queries against real DynamoDB semantics
- keep the dev stack lightweight

Core principle:

> Local development runs the application locally, not a full fake AWS cloud.

---

## 2. Local Architecture

```text
Browser
   │
Frontend Dev Server
   │
Local API (SAM CLI → Lambda runtime)
   │
DynamoDB Local
   │
Local Media Folder
```

Infrastructure definition still comes from CDK.

```text
CDK
  └─ cdk synth → CloudFormation templates
         │
         ▼
SAM CLI uses those templates
to run Lambda/API locally
```

---

## 3. Local Services

### DynamoDB Local

Runs the DynamoDB API locally.

```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

Endpoint:

```text
http://localhost:8000
```

Supports:

- tables
- GSIs
- batch operations
- transactions

### SAM CLI

Typical flow:

```bash
cdk synth
sam local start-api
```

SAM reads the synthesized template and runs Lambda handlers locally.

### Local Media Storage

Instead of object storage:

```text
/local_media/
   samples/
   spectrograms/
```

The local API can return media URLs that map to local files.

---

## 4. Docker Compose

A minimal local stack should at least include DynamoDB Local.

```yaml
version: "3"

services:
  dynamodb:
    image: amazon/dynamodb-local
    ports:
      - "8000:8000"
    command: "-jar DynamoDBLocal.jar -sharedDb -inMemory"
```

---

## 5. Local Environment Variables

Example:

```env
APP_ENV=local
DYNAMODB_ENDPOINT=http://localhost:8000
CATALOG_TABLE=Catalog
LABELS_TABLE=Labels
MEDIA_ROOT=./local_media
AUTH_MODE=dev
AWS_REGION=us-west-2
```

---

## 6. Local Authentication Mode

Cognito is not needed locally.

Use a dev-auth mode, for example:

```text
x-dev-user: dev_user_1
x-dev-role: annotator
```

Admin testing:

```text
x-dev-user: admin_user
x-dev-role: admin
```

---

## 7. Table Creation Locally

Use a bootstrap script to create local tables and indexes.

Example:

```bash
npm run db:local:init
```

The script should:

1. check whether tables already exist
2. create missing tables
3. wait until they are active

---

## 8. Seed Data Loader

Use a seed script for UI development.

Example:

```bash
npm run db:local:seed
```

Suggested seed data:

- 2–3 folders
- 200–500 samples
- random test labels

---

## 9. Local Development Workflow

### Step 1 — start infrastructure

```bash
docker compose up -d
```

### Step 2 — create tables

```bash
npm run db:local:init
```

### Step 3 — load seed data

```bash
npm run db:local:seed
```

### Step 4 — synth infrastructure

```bash
cdk synth
```

### Step 5 — start local API

```bash
sam local start-api
```

API endpoint:

```text
http://localhost:3000
```

### Step 6 — start frontend

```bash
npm run dev
```

---

## 10. Request Flow (Local)

Example: open sample.

```text
Browser
   │
   ├── GET /samples/{id} → local Lambda/API
   │
   └── GET /media/... → local filesystem
```

Example: submit label.

```text
Browser
   │
POST /samples/{id}/label
   │
Local Lambda/API
   │
DynamoDB Local
```

---

## 11. Testing Tools

A useful companion tool is AWS NoSQL Workbench connected to:

```text
localhost:8000
```

This helps inspect:

- table items
- GSIs
- query behavior

---

## 12. Deployment Workflow

Local development never needs real AWS.

Cloud deployment remains:

```bash
cdk synth
cdk deploy
```

---

## 13. Recommended Directory Layout

```text
repo/
  cdk/
  api/
  frontend/
  local_media/
  scripts/
  tests/
  docker-compose.yml
```

---

## 14. Guiding Principle

Keep local development simple and fast.

Use:

- DynamoDB Local
- SAM CLI
- local media files
- dev auth mode

Keep CDK as the single source of infrastructure truth.
