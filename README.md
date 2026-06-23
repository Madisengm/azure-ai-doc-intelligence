# 🧠 Azure AI Document Intelligence Dashboard

[![Deploy to Azure Static Web Apps](https://github.com/Madisengm/azure-ai-doc-intelligence/actions/workflows/azure-static-web-apps-salmon-wave-012e1d61e.yml/badge.svg)](https://github.com/Madisengm/azure-ai-doc-intelligence/actions)
[![Azure](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure&logoColor=white)](https://salmon-wave-012e1d61e.7.azurestaticapps.net)
[![Angular](https://img.shields.io/badge/Angular-17+-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Azure Functions](https://img.shields.io/badge/Azure_Functions-v4-0062AD?logo=azurefunctions&logoColor=white)](https://learn.microsoft.com/en-us/azure/azure-functions)
[![Cosmos DB](https://img.shields.io/badge/Cosmos_DB-Vector_Search-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/cosmos-db)
[![Azure AI](https://img.shields.io/badge/Azure_AI-Document_Intelligence-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence)
[![SignalR](https://img.shields.io/badge/Azure-SignalR_Service-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/azure-signalr)
[![Event Grid](https://img.shields.io/badge/Azure-Event_Grid-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/event-grid)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

> Upload any document — CV, invoice, receipt, certificate, or ID — and have Azure AI extract structured data, generate semantic embeddings, and find similar documents using vector search. Processing is triggered automatically via Azure Event Grid. Results stream to the browser in real time via Azure SignalR Service.

**Live site:** [https://salmon-wave-012e1d61e.7.azurestaticapps.net](https://salmon-wave-012e1d61e.7.azurestaticapps.net)

---

## Architecture

```
Browser (Angular 17+)
  │
  │  1. POST /api/get-upload-url  → SAS URL (10 min, create+write only)
  │  2. PUT  file directly to Blob Storage via SAS URL (no Function proxy)
  │         │
  │         └── BlobCreated event → Azure Event Grid
  │                                       │
  │                                       ▼
  │                          Standalone Azure Function App
  │                          (process-document-eventgrid)
  │                                ├── download blob
  │                                ├── Azure AI Document Intelligence
  │                                ├── generate 384-dim embedding (ONNX)
  │                                ├── upsert to Cosmos DB
  │                                └── push via SignalR → browser updates
  │
  │  3. GET  /api/get-results         → all history (embedding stripped)
  │     GET  /api/results/:id         → single result
  │     GET  /api/find-similar/:id    → top 5 by cosine distance
  │     POST /api/search-documents    → semantic search (embed query → VectorDistance)
  │
  ▼
Azure Static Web Apps
  ├── Angular 17+ Frontend       (standalone, signals, lazy routes)
  ├── getUploadUrl Function      (POST) SAS token generation
  ├── getResults Function        (GET)  all results from Cosmos DB
  ├── getResultById Function     (GET)  point read by id
  ├── findSimilar Function       (GET)  vector similarity: top 5 by VectorDistance
  ├── searchDocuments Function   (POST) embed query → vector search
  └── signalrNegotiate Function  (GET/POST) WebSocket connection token

Standalone Azure Function App (ai-doc-eventgrid-processor)
  └── processDocumentEventGrid   (POST) Event Grid webhook receiver
           │
           ▼
  Azure Cosmos DB    (NoSQL + vector index, partition key /id)
  Azure SignalR      (Serverless, docIntelligence hub)
  Azure Blob Storage (SAS-scoped upload, /documents container)
  Azure AI Doc Intel (prebuilt models per document type)
  Azure Event Grid   (BlobCreated subscription on /documents container)

GitHub Actions
  ├── 53 Cypress E2E tests (gate deployment)
  ├── Deploy to Azure Static Web Apps
  └── Live smoke tests against production
```

---

## The upload and processing flow in detail

**1. Angular uploads directly to Blob Storage, not through a Function.**
The `getUploadUrl` Function generates a SAS (Shared Access Signature) URL with `cw` (create + write) permissions and a 10-minute expiry. Angular `PUT`s the file directly to Blob Storage — the Function never handles binary payloads. This eliminates memory pressure, makes upload speed independent of Function cold starts, and scopes the token so a compromised SAS can only write one specific blob. `startsOn` is set 5 minutes in the past to absorb clock skew — a common cause of 403 errors in production.

**2. Event Grid triggers processing automatically.**
Azure Event Grid subscribes to `BlobCreated` events on the `/documents` container. When a blob lands, Event Grid delivers a webhook POST to a standalone Azure Function App (`ai-doc-eventgrid-processor`). The Function handles the validation handshake on subscription creation, then processes each `BlobCreated` event by extracting the blob path from the event payload. An idempotency check prevents duplicate processing if Event Grid retries — the Function always returns HTTP 200 so Event Grid never retries due to a 5xx response. The standalone Function App was necessary because Azure Static Web Apps Free tier doesn't support Event Grid webhook subscriptions (requires Standard SKU).

**3. Embeddings are generated in the Function, stored in Cosmos DB, never sent to the frontend.**
After AI extraction, the Function generates a 384-dimension semantic embedding using `all-MiniLM-L6-v2` (ONNX, via `@xenova/transformers`). The model runs inside the Function on Windows Consumption plan — no external embedding API call needed. The same model is used for both indexing documents and embedding search queries, so vector distances are directly comparable.

**4. SignalR pushes results to the browser in real time.**
Angular holds a persistent WebSocket connection to Azure SignalR Service via the `negotiate` Function. When processing completes, the Event Grid Function uses a SignalR output binding to push the result to every connected client. Angular upserts it into the results list — updating in place if the document already exists, prepending if new.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Angular 17+ (standalone) | SPA with signals, lazy routes, drag and drop |
| Styling | Tailwind CSS 3 | Utility-first responsive design |
| Upload | Azure Blob Storage + SAS | Direct browser-to-storage upload |
| Event trigger | Azure Event Grid | BlobCreated → processDocumentEventGrid |
| AI extraction | Azure AI Document Intelligence | Prebuilt models for 5 document types |
| Embeddings | all-MiniLM-L6-v2 (ONNX) | 384-dim semantic embeddings, no external API |
| Vector search | Cosmos DB vector index | Cosine similarity search via VectorDistance() |
| SWA Functions | Azure Functions v4 (Node.js) | 6 HTTP-triggered Functions on SWA managed host |
| Event Function | Azure Functions v4 (Node.js) | Standalone Function App for Event Grid webhook |
| Database | Azure Cosmos DB (NoSQL) | Extraction results + vector index, partition key `/id` |
| Real-time | Azure SignalR Service | WebSocket push — processing → completed instantly |
| Hosting | Azure Static Web Apps | Unified frontend + API hosting |
| Testing | Cypress | 53 E2E tests gating every deployment |
| CI/CD | GitHub Actions | Test → build → deploy → smoke test pipeline |
| Language | TypeScript (ES2020) | Frontend and backend |

---

## Document types and AI models

| Type | Azure AI model | Fields extracted | High-value fields for embedding |
|---|---|---|---|
| CV / Resume | `prebuilt-document` | Key-value pairs, layout | Name, Skills, Summary, Experience |
| Invoice | `prebuilt-invoice` | Vendor, amounts, line items, dates | VendorName, InvoiceTotal, Items |
| Receipt | `prebuilt-receipt` | Merchant, total, items | MerchantName, Total, Items |
| Certificate | `prebuilt-document` | Title, issuer, holder, date | Title, IssuedTo, IssuedBy |
| ID Document | `prebuilt-idDocument` | Name, DOB, ID number | FirstName, LastName, Nationality |

---

## AI-200 exam domains this project covers

| AI-200 Domain | How this project covers it |
|---|---|
| Implement Azure Functions | 7 HTTP-triggered Functions across two hosting models: SWA managed host and standalone Consumption plan |
| Develop solutions using Blob Storage | SAS token generation, scoped permissions, direct browser upload, blob download in Function |
| Develop solutions using Cosmos DB | NoSQL storage, point reads (~1 RU), upsert, vector indexing policy, VectorDistance queries |
| Implement Azure AI services | Document Intelligence REST API, prebuilt model routing per document type, confidence scores |
| Implement event-driven solutions | Event Grid BlobCreated subscription, webhook validation handshake, retry idempotency pattern |
| Implement real-time solutions | SignalR output binding, negotiate Function, WebSocket connection with auto-reconnect |
| Implement vector search | 384-dim ONNX embeddings, cosine distance, semantic search, find similar documents |
| Secure Azure solutions | SAS token scoping, env var secret management, never committing credentials |
| Monitor and troubleshoot | Application Insights across Angular, SWA Functions, and standalone Function App |
| Connect and consume Azure services | Coordinating Blob, Event Grid, Cosmos DB, AI, SignalR, and embeddings in one pipeline |

---

## Project Structure

```
azure-ai-doc-intelligence/
├── frontend/                          # Angular 17+ application
│   ├── cypress/
│   │   ├── e2e/
│   │   │   ├── upload.cy.ts          # 15 upload tests
│   │   │   ├── history.cy.ts         # 18 history + semantic search tests
│   │   │   └── result.cy.ts          # 20 result + find similar tests
│   │   └── fixtures/
│   │       ├── extraction-results.json
│   │       ├── extraction-result.json
│   │       ├── upload-url.json
│   │       └── similar-results.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── models/
│   │   │   │   │   └── document.model.ts         # ExtractionResult, DocumentType, DOCUMENT_TYPE_CONFIG
│   │   │   │   └── services/
│   │   │   │       ├── api.service.ts             # HTTP calls to all 6 SWA Functions
│   │   │   │       ├── upload.service.ts          # SAS upload, no explicit processDocument call
│   │   │   │       └── signalr.service.ts         # WebSocket connection + event subscription
│   │   │   ├── features/
│   │   │   │   ├── upload/                        # Drag and drop, type selector, progress bar
│   │   │   │   ├── result/                        # Fields, confidence, raw JSON, find similar
│   │   │   │   └── history/                       # SignalR live indicator, semantic search bar
│   │   │   └── app.routes.ts                      # Lazy-loaded: /upload /result/:id /history
│   │   └── environments/
│   │       ├── environment.ts
│   │       └── environment.prod.ts
│   ├── public/
│   │   └── staticwebapp.config.json              # SPA routing — copied into build output
│   └── angular.json
│
├── api/                               # Azure Functions on SWA managed host
│   ├── src/
│   │   ├── index.ts                              # Entry point — imports all Functions
│   │   ├── functions/
│   │   │   ├── getUploadUrl.ts                   # POST /api/get-upload-url
│   │   │   ├── getResults.ts                     # GET  /api/get-results
│   │   │   ├── getResultById.ts                  # GET  /api/results/{id}
│   │   │   ├── findSimilar.ts                    # GET  /api/find-similar/{id}
│   │   │   ├── searchDocuments.ts                # POST /api/search-documents
│   │   │   └── signalrNegotiate.ts               # GET/POST /api/negotiate
│   │   └── services/
│   │       ├── blobService.ts
│   │       ├── cosmosService.ts                  # Point reads, upsert, VectorDistance query
│   │       ├── documentIntelligenceService.ts
│   │       ├── embeddingService.ts               # all-MiniLM-L6-v2 ONNX singleton
│   │       └── fieldExtractor.ts                 # High-value field selection per document type
│   └── tsconfig.json
│
├── api-eventgrid/                     # Standalone Function App for Event Grid
│   ├── src/
│   │   ├── index.ts
│   │   ├── functions/
│   │   │   └── processDocumentEventGrid.ts       # POST — Event Grid webhook receiver
│   │   └── services/                             # Shared copies of api/ services
│   │       ├── blobService.ts
│   │       ├── cosmosService.ts                  # Includes findByBlobName() for idempotency
│   │       ├── documentIntelligenceService.ts
│   │       ├── embeddingService.ts
│   │       └── fieldExtractor.ts
│   └── host.json
│
└── .github/
    └── workflows/
        └── azure-static-web-apps-salmon-wave-012e1d61e.yml
```

---

## Key Technical Decisions

### SAS-based direct upload
Files never route through a Function. The `getUploadUrl` Function generates a SAS URL with `cw` (create + write) permissions and a 10-minute expiry. `startsOn` is set 5 minutes in the past to absorb clock skew. Angular `PUT`s directly to Blob Storage — once the upload completes, Angular navigates to history and waits for the SignalR push.

### Event Grid for event-driven processing
Rather than having Angular explicitly call a processing endpoint after upload, Azure Event Grid subscribes to `BlobCreated` events on the storage container. This decouples upload from processing — if the browser closes immediately after the upload completes, processing still runs. The Event Grid Function handles the validation handshake by echoing back the `validationCode`. It always returns HTTP 200 — even on errors — to prevent Event Grid's retry mechanism from causing duplicate processing records. An idempotency check (`findByBlobName`) ensures that if Event Grid does retry, already-completed documents are skipped.

### Standalone Function App for Event Grid (not SWA managed host)
Azure Static Web Apps Free tier only supports HTTP-triggered Functions on its managed host — Event Grid webhook subscriptions require Standard SKU. A separate Consumption plan Function App (`ai-doc-eventgrid-processor`) is used for the Event Grid receiver. This is free (Consumption plan billing) and demonstrates multi-host Azure Functions architecture. Linux Consumption was avoided after runtime instability with Node.js v4; Windows Consumption resolved the issue.

### ONNX embeddings inside the Function
`all-MiniLM-L6-v2` runs inside the Azure Function via `@xenova/transformers` — no Azure OpenAI dependency, no external API cost. The model is cached after the first cold start. The same model is used for both indexing and querying so vector distances are directly comparable.

### High-value field selection for embeddings
Each document type maps to a curated set of high-value fields for embedding. A CV embedding includes Name, Skills, and Experience — not page numbers or formatting artifacts. This improves semantic similarity: two CVs for Angular developers cluster closer together than a CV and an invoice with the same word count.

### Cosmos DB vector index with cosine distance
The container uses a `flat` vector index suitable for portfolio-scale datasets. Partition key `/id` enables point reads (~1 RU) instead of cross-partition queries. The embedding field is excluded from the standard indexing policy. The vector search query uses `IS_ARRAY(c.embedding)` to filter out documents without embeddings.

### SignalR replaces polling
The history page holds a persistent WebSocket connection. When the Event Grid Function completes processing, it uses a SignalR output binding to push the result to all connected clients. Angular upserts it — updating in place or prepending as new. `withAutomaticReconnect([0, 2000, 5000, 10000])` handles connection drops with exponential backoff.

### Embedding stripped from API responses
The 384-element float array is stored in Cosmos DB but stripped before returning to Angular. `getAllResults()` maps through `({ embedding, ...rest }) => rest`. This keeps API payloads lean — avoids ~6KB of float data per result on every history page load.

---

## Running Locally

### Prerequisites
- Node.js 18+
- Angular CLI: `npm install -g @angular/cli`
- Azure Functions Core Tools v4: `npm install -g azure-functions-core-tools@4`

### 1. Clone and configure
```bash
git clone https://github.com/Madisengm/azure-ai-doc-intelligence.git
cd azure-ai-doc-intelligence
cd api && cp local.settings.example.json local.settings.json
```

### 2. Start the API (SWA Functions)
```bash
cd api && npm install && npm run start
```

### 3. Start the frontend
```bash
cd frontend && npm install && ng serve
```

> The Event Grid Function (`api-eventgrid/`) only runs in Azure — it requires a real Event Grid subscription. For local development, use the SWA `processDocument` Function directly.

---

## Testing

53 E2E tests across 3 spec files, all mocked — no real Azure calls needed.

| Spec | Tests | What is tested |
|---|---|---|
| `upload.cy.ts` | 15 | Rendering, type selection, file validation, upload flow, Event Grid success message |
| `history.cy.ts` | 18 | Results list, status badges, confidence scores, semantic search bar, empty state |
| `result.cy.ts` | 20 | Field cards, confidence badges, raw JSON toggle, find similar, navigation |

---

## API Reference

### `POST /api/get-upload-url`
Generates a SAS URL for direct browser upload.

**Request:** `{ "fileName": "cv.pdf", "fileType": "application/pdf", "documentType": "cv" }`
**Response:** `{ "sasUrl": "https://...?sp=cw&sig=...", "blobName": "cv/1234-cv.pdf", "documentType": "cv" }`

---

### `GET /api/get-results`
All results ordered by `processedAt` descending. Embedding stripped from response.

---

### `GET /api/results/{id}`
Single result by id (point read, ~1 RU).

---

### `GET /api/find-similar/{id}`
Top 5 documents most similar to the given id using cosine vector distance. Requires the source document to have an embedding.

**Response:** `{ "results": [{ ...result, "similarityScore": 0.12 }] }`

---

### `POST /api/search-documents`
Embeds the query string using the same ONNX model used for indexing, then runs a vector similarity search.

**Request:** `{ "query": "Angular developer with Azure experience" }`
**Response:** `{ "results": [{ ...result, "similarityScore": 0.26 }] }`

---

### `GET /api/negotiate`
Returns WebSocket connection info for Azure SignalR Service.

---

### `POST /api/process-document-eventgrid` (standalone Function App)
Receives Event Grid webhook events. Handles the validation handshake and processes `BlobCreated` events. Always returns HTTP 200. Includes idempotency check to prevent duplicate records on Event Grid retries.

---

## Deployment

### SWA (frontend + API Functions)
Every `git push` to `main` runs four jobs:
1. **Cypress** — 53 E2E tests. Blocks deploy on failure.
2. **Build and Deploy** — Oryx builds Angular + TypeScript, deploys to SWA.
3. **Smoke test** — Cypress runs against live production URL.
4. **Close PR** — tears down preview environment on PR close.

### Event Grid Function App
Deployed independently via Azure Functions Core Tools:
```bash
cd api-eventgrid
npm run build
func azure functionapp publish ai-doc-eventgrid-processor --build local
```

---

## Azure Resources

| Resource | Name | Purpose |
|---|---|---|
| Resource Group | `ai-doc-intelligence-rg` | Container for all project resources |
| Storage Account | `aidintelstorage` | Blob Storage for uploaded documents |
| Storage Account | `aidoceventstore` | Runtime storage for Event Grid Function App |
| Cosmos DB | `madisengazresume` | NoSQL + vector index for extraction results |
| Document Intelligence | `ai-doc-intelligence` | Azure AI extraction (F0, 500 pages/month free) |
| SignalR Service | `ai-doc-signalr` | Real-time WebSocket push (Free_F1, 20k msg/day) |
| Event Grid Subscription | `doc-blob-created` | BlobCreated → processDocumentEventGrid webhook |
| Function App | `ai-doc-eventgrid-processor` | Standalone Windows Consumption plan for Event Grid |
| Static Web Apps | `ai-doc-intelligence` | Frontend + SWA Functions hosting (Free tier) |

---

## Author

**Mahlatse Madiseng**
Frontend Engineer · Cloud Solutions Developer · Azure Serverless Specialist

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/mahlatse-madiseng/)