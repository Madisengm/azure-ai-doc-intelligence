# 🧠 Azure AI Document Intelligence Dashboard

[![Deploy to Azure Static Web Apps](https://github.com/Madisengm/azure-ai-doc-intelligence/actions/workflows/azure-static-web-apps-salmon-wave-012e1d61e.yml/badge.svg)](https://github.com/Madisengm/azure-ai-doc-intelligence/actions)
[![Azure](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure&logoColor=white)](https://salmon-wave-012e1d61e.7.azurestaticapps.net)
[![Angular](https://img.shields.io/badge/Angular-17+-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Azure Functions](https://img.shields.io/badge/Azure_Functions-v4-0062AD?logo=azurefunctions&logoColor=white)](https://learn.microsoft.com/en-us/azure/azure-functions)
[![Cosmos DB](https://img.shields.io/badge/Cosmos_DB-Vector_Search-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/cosmos-db)
[![Azure AI](https://img.shields.io/badge/Azure_AI-Document_Intelligence-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence)
[![SignalR](https://img.shields.io/badge/Azure-SignalR_Service-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/azure-signalr)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

> Upload any document — CV, invoice, receipt, certificate, or ID — and have Azure AI Document Intelligence extract structured data, generate semantic embeddings, and find similar documents using vector search. Results stream to the browser in real time via Azure SignalR Service.

**Live site:** [https://salmon-wave-012e1d61e.7.azurestaticapps.net](https://salmon-wave-012e1d61e.7.azurestaticapps.net)

---

## Architecture

```
Browser (Angular 17+)
  │
  │  1. POST /api/get-upload-url  → SAS URL (10 min, create+write only)
  │  2. PUT  file directly to Blob Storage via SAS URL (no Function proxy)
  │  3. POST /api/process-document
  │         ├── download blob
  │         ├── Azure AI Document Intelligence (prebuilt model routing)
  │         ├── generate 384-dim embedding (all-MiniLM-L6-v2, ONNX)
  │         ├── upsert to Cosmos DB (fields + embedding + vector index)
  │         └── push via SignalR → browser updates in real time
  │
  │  4. GET  /api/get-results         → all history (embedding stripped)
  │     GET  /api/results/:id         → single result
  │     GET  /api/find-similar/:id    → top 5 by cosine distance
  │     POST /api/search-documents    → semantic search (embed query → VectorDistance)
  │
  ▼
Azure Static Web Apps
  ├── Angular 17+ Frontend       (standalone, signals, lazy routes)
  ├── getUploadUrl Function      (POST) SAS token generation
  ├── processDocument Function   (POST) AI extraction + embedding + SignalR push
  ├── getResults Function        (GET)  all results from Cosmos DB
  ├── getResultById Function     (GET)  point read by id
  ├── findSimilar Function       (GET)  vector similarity: top 5 by VectorDistance
  ├── searchDocuments Function   (POST) embed query → vector search
  └── signalrNegotiate Function  (GET/POST) WebSocket connection token
           │
           ▼
  Azure Cosmos DB (NoSQL + vector index, partition key /id)
  Azure SignalR Service (Serverless mode, docIntelligence hub)
  Azure Blob Storage (SAS-scoped upload, /documents container)
  Azure AI Document Intelligence (prebuilt models per document type)

GitHub Actions
  ├── 53 Cypress E2E tests (gate deployment)
  ├── Deploy to Azure Static Web Apps
  └── Live smoke tests against production
```

---

## The upload and processing flow in detail

The most important architectural decisions in this project are about what goes where:

**1. Angular uploads directly to Blob Storage, not through a Function.**
The `getUploadUrl` Function generates a SAS (Shared Access Signature) URL with `cw` (create + write) permissions and a 10-minute expiry. Angular `PUT`s the file directly to Blob Storage using this URL — the Function never handles binary payloads. This eliminates memory pressure on the Function, makes upload speed independent of Function cold starts, and scopes the SAS token so a compromised token can only write one specific blob.

**2. Embeddings are generated in the Function, stored in Cosmos DB, never sent to the frontend.**
After AI extraction, the Function generates a 384-dimension semantic embedding using `all-MiniLM-L6-v2` (ONNX, via `@xenova/transformers`). The model runs inside the Function — no external embedding API call needed. The embedding is stored alongside the extraction result in Cosmos DB. When the history list is returned to Angular, the embedding field is stripped — it's a 384-element float array that Angular doesn't need for rendering.

**3. SignalR replaces polling.**
Instead of polling `GET /api/get-results` every N seconds, Angular holds a WebSocket connection to Azure SignalR Service. When `processDocument` finishes, it uses a SignalR output binding to push the completed result to every connected client instantly. Angular `upserts` it into the results list — updating in place if the result already exists, prepending if it's new.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Angular 17+ (standalone) | SPA with signals, lazy routes, drag and drop |
| Styling | Tailwind CSS 3 | Utility-first responsive design |
| Upload | Azure Blob Storage + SAS | Direct browser-to-storage upload |
| AI extraction | Azure AI Document Intelligence | Prebuilt models for 5 document types |
| Embeddings | all-MiniLM-L6-v2 (ONNX) | 384-dim semantic embeddings, no external API |
| Vector search | Cosmos DB vector index | Cosine similarity search via VectorDistance() |
| Backend | Azure Functions v4 (Node.js) | 7 HTTP-triggered serverless Functions |
| Database | Azure Cosmos DB (NoSQL) | Extraction results + vector index, partition key `/id` |
| Real-time | Azure SignalR Service | WebSocket push — processing → completed instantly |
| Hosting | Azure Static Web Apps | Unified frontend + API hosting |
| Testing | Cypress | 41 E2E tests gating every deployment |
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

Each document type maps to the most accurate prebuilt model for that domain. The embedding is generated from a curated subset of high-value fields per type — not all extracted text — to maximise semantic similarity relevance.

---

## AI-200 exam domains this project covers

| AI-200 Domain | How this project covers it |
|---|---|
| Implement Azure Functions | 7 HTTP-triggered Functions in Node.js v4 programming model with input/output bindings |
| Develop solutions using Blob Storage | SAS token generation, scoped permissions, direct browser upload, blob download |
| Develop solutions using Cosmos DB | NoSQL document storage, point reads, upsert, vector indexing policy, VectorDistance queries |
| Implement Azure AI services | Document Intelligence REST API, prebuilt model routing, confidence scores |
| Implement real-time solutions | SignalR output binding, negotiate Function, WebSocket connection management |
| Implement vector search | 384-dim embeddings, cosine distance, semantic search, find similar documents |
| Secure Azure solutions | SAS token scoping, env var secret management, never committing credentials |
| Monitor and troubleshoot | Application Insights across Angular frontend and Azure Functions |
| Connect and consume Azure services | Coordinating Blob, Cosmos DB, AI, SignalR, and embeddings in one pipeline |

---

## Project Structure

```
azure-ai-doc-intelligence/
├── frontend/                          # Angular 17+ application
│   ├── cypress/
│   │   ├── e2e/
│   │   │   ├── upload.cy.ts          # 15 upload tests
│   │   │   ├── history.cy.ts         # 12 history tests
│   │   │   └── result.cy.ts          # 14 result tests
│   │   └── fixtures/
│   │       ├── extraction-results.json
│   │       ├── extraction-result.json
│   │       └── upload-url.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── models/
│   │   │   │   │   └── document.model.ts         # ExtractionResult, DocumentType, DOCUMENT_TYPE_CONFIG
│   │   │   │   └── services/
│   │   │   │       ├── api.service.ts             # HTTP calls to all 7 Functions
│   │   │   │       ├── upload.service.ts          # SAS upload + processDocument orchestration
│   │   │   │       └── signalr.service.ts         # WebSocket connection + event subscription
│   │   │   ├── features/
│   │   │   │   ├── upload/                        # Drag and drop, type selector, progress bar
│   │   │   │   ├── result/                        # Fields, confidence, raw JSON, find similar
│   │   │   │   └── history/                       # SignalR live updates, semantic search bar
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts
│   │   │   └── app.routes.ts                      # Lazy-loaded: /upload /result/:id /history
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.prod.ts
│   │   └── styles.css
│   ├── proxy.conf.json                            # /api → localhost:7071 (dev only)
│   └── angular.json
│
├── api/                               # Azure Functions v4
│   ├── src/
│   │   ├── index.ts                              # Entry point — imports all Functions
│   │   ├── functions/
│   │   │   ├── getUploadUrl.ts                   # POST /api/get-upload-url
│   │   │   ├── processDocument.ts                # POST /api/process-document
│   │   │   ├── getResults.ts                     # GET  /api/get-results
│   │   │   ├── getResultById.ts                  # GET  /api/results/{id}
│   │   │   ├── findSimilar.ts                    # GET  /api/find-similar/{id}
│   │   │   ├── searchDocuments.ts                # POST /api/search-documents
│   │   │   └── signalrNegotiate.ts               # GET/POST /api/negotiate
│   │   └── services/
│   │       ├── blobService.ts                    # Blob download helper
│   │       ├── cosmosService.ts                  # Point reads, upsert, VectorDistance query
│   │       ├── documentIntelligenceService.ts    # AI extraction, prebuilt model routing
│   │       ├── embeddingService.ts               # all-MiniLM-L6-v2 ONNX singleton
│   │       └── fieldExtractor.ts                 # High-value field selection per document type
│   ├── host.json
│   ├── local.settings.json                       # ⚠️ git-ignored — never commit
│   ├── local.settings.example.json               # Safe placeholder for contributors
│   └── tsconfig.json
│
├── staticwebapp.config.json           # SWA routing — SPA fallback, API passthrough
├── frontend/public/staticwebapp.config.json  # Copied into build output for SPA routing
└── .github/
    └── workflows/
        └── azure-static-web-apps-salmon-wave-012e1d61e.yml
```

---

## Key Technical Decisions

### SAS-based direct upload
Files never route through a Function. The `getUploadUrl` Function generates a SAS URL with `cw` (create + write) permissions and a 10-minute expiry window. `startsOn` is set 5 minutes in the past to absorb clock skew between the client and Azure — a common cause of 403 errors in production. Angular `PUT`s directly to Blob Storage, then explicitly calls `POST /api/process-document` with the blob name.

### HTTP trigger instead of blob trigger
Azure Static Web Apps only supports HTTP-triggered Functions in its managed host. Blob triggers require Webjobs storage infrastructure that SWA doesn't expose. Converting to an explicit HTTP call makes processing synchronous from Angular's perspective — the Function returns the `resultId` directly, so Angular navigates straight to the result page without polling.

### ONNX embeddings inside the Function
`all-MiniLM-L6-v2` runs entirely inside the Azure Function via `@xenova/transformers` and ONNX Runtime — no external embedding API call, no Azure OpenAI dependency, no cost. The model is cached to `/tmp/models` after the first cold start. The same model is used for both indexing documents and embedding search queries, so vector distances are directly comparable.

### High-value field selection for embeddings
Rather than embedding all extracted text, each document type maps to a curated set of high-value fields. A CV embedding includes Name, Skills, and Experience — not page numbers or formatting artifacts. This improves semantic similarity relevance significantly: two CVs for Angular developers will cluster closer together than a CV and an invoice with the same word count.

### Cosmos DB vector index with cosine distance
The container uses a `flat` vector index — correct for a portfolio-scale dataset with no minimum document count requirement. The partition key is `/id` enabling point reads (~1 RU) instead of queries (~2.5 RU) for single-document lookups. The embedding field is excluded from the standard indexing policy to avoid unnecessary index overhead.

### SignalR replaces polling
The history page holds a persistent WebSocket connection via Azure SignalR Service. When `processDocument` completes, it uses a SignalR output binding to push the result to all connected clients. Angular upserts it — updating in place if the document already exists in the list, prepending if it's new. `withAutomaticReconnect([0, 2000, 5000, 10000])` handles connection drops with exponential backoff.

### Embedding stripped from API responses
The 384-element float array is stored in Cosmos DB for vector queries but stripped before returning results to Angular. `getAllResults()` maps the response through `({ embedding, ...rest }) => rest` before returning. This keeps the API payload lean and avoids sending ~6KB of float data per result on every history page load.

---

## Running Locally

### Prerequisites
- Node.js 18+
- Angular CLI: `npm install -g @angular/cli`
- Azure Functions Core Tools v4: `npm install -g azure-functions-core-tools@4`

### 1. Clone the repo
```bash
git clone https://github.com/Madisengm/azure-ai-doc-intelligence.git
cd azure-ai-doc-intelligence
```

### 2. Configure environment variables
```bash
cd api
cp local.settings.example.json local.settings.json
```

Edit `local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_ACCOUNT": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net",
    "STORAGE_ACCOUNT_NAME": "YOUR_STORAGE_ACCOUNT_NAME",
    "STORAGE_ACCOUNT_KEY": "YOUR_STORAGE_KEY",
    "STORAGE_CONTAINER_NAME": "documents",
    "COSMOS_DB_ENDPOINT": "https://YOUR_ACCOUNT.documents.azure.com:443/",
    "COSMOS_DB_KEY": "YOUR_COSMOS_KEY",
    "COSMOS_DB_DATABASE": "YOUR_DATABASE_NAME",
    "COSMOS_DB_CONTAINER": "results",
    "DOCUMENT_INTELLIGENCE_ENDPOINT": "https://YOUR_RESOURCE.cognitiveservices.azure.com/",
    "DOCUMENT_INTELLIGENCE_KEY": "YOUR_KEY",
    "AZURE_SIGNALR_CONNECTION_STRING": "YOUR_SIGNALR_CONNECTION_STRING"
  }
}
```

### 3. Configure Blob Storage CORS for local development
```bash
az storage cors add \
  --account-name YOUR_STORAGE_ACCOUNT \
  --services b \
  --methods GET PUT POST DELETE OPTIONS HEAD \
  --origins "http://localhost:4200" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600
```

### 4. Start the API
```bash
cd api
npm install
npm run start
```

All 7 Functions register:
```
Functions:
  find-similar:       [GET,OPTIONS]       http://localhost:7071/api/find-similar/{id}
  get-result-by-id:   [GET,OPTIONS]       http://localhost:7071/api/results/{id}
  get-results:        [GET,OPTIONS]       http://localhost:7071/api/get-results
  get-upload-url:     [POST,OPTIONS]      http://localhost:7071/api/get-upload-url
  process-document:   [POST,OPTIONS]      http://localhost:7071/api/process-document
  search-documents:   [POST,OPTIONS]      http://localhost:7071/api/search-documents
  signalr-negotiate:  [GET,POST,OPTIONS]  http://localhost:7071/api/negotiate
```

### 5. Start the frontend
```bash
cd frontend
npm install
ng serve
```

---

## Testing

41 E2E tests across 3 spec files, all mocked against fixtures — no real Azure calls needed to run the suite.

| Spec | Tests | What is tested |
|---|---|---|
| `upload.cy.ts` | 15 | Page rendering, document type selection, file validation, upload flow |
| `history.cy.ts` | 12 | Results list, status badges, confidence scores, empty state, navigation |
| `result.cy.ts` | 14 | Field cards, confidence badges, raw JSON toggle, back navigation |

```bash
# Terminal 1
cd frontend && ng serve

# Terminal 2
cd frontend && npm run cypress:run
```

---

## API Reference

### `POST /api/get-upload-url`
Generates a SAS URL for direct browser upload.

**Request:** `{ "fileName": "cv.pdf", "fileType": "application/pdf", "documentType": "cv" }`

**Response:** `{ "sasUrl": "https://...?sp=cw&sig=...", "blobName": "cv/1234-cv.pdf", "documentType": "cv" }`

---

### `POST /api/process-document`
Downloads blob, runs AI extraction, generates embedding, saves to Cosmos DB, pushes via SignalR.

**Request:** `{ "blobName": "cv/1234-cv.pdf", "documentType": "cv" }`

**Response:** `{ "id": "uuid", "status": "completed" }`

---

### `GET /api/get-results`
All results ordered by `processedAt` descending. Embedding stripped from response.

**Response:** `{ "results": [{ "id": "...", "fileName": "...", "fields": {...}, ... }] }`

---

### `GET /api/results/{id}`
Single result by id (point read, ~1 RU).

---

### `GET /api/find-similar/{id}`
Top 5 documents most similar to the given id using cosine vector distance.

**Response:** `{ "results": [{ ...result, "similarityScore": 0.12 }] }` *(lower score = more similar in cosine distance)*

---

### `POST /api/search-documents`
Embeds the query string and runs a vector similarity search across all documents.

**Request:** `{ "query": "Angular developer with Azure experience" }`

**Response:** `{ "results": [{ ...result, "similarityScore": 0.26 }] }`

---

### `GET /api/negotiate`
Returns WebSocket connection info for Azure SignalR Service. Called once by the Angular SignalR client on history page mount.

---

## Deployment

Every `git push` to `main` runs four jobs in sequence:

1. **Cypress** — 41 E2E tests against `ng serve`. Blocks all downstream jobs on failure.
2. **Build and Deploy** — Oryx builds Angular and TypeScript, deploys to Azure Static Web Apps.
3. **Smoke test** — Cypress runs `upload.cy.ts` and `history.cy.ts` against the live production URL.
4. **Close PR** — tears down the preview environment on PR close.

```bash
az staticwebapp appsettings set \
  --name ai-doc-intelligence \
  --setting-names \
    STORAGE_ACCOUNT="..." \
    COSMOS_DB_ENDPOINT="..." \
    COSMOS_DB_KEY="..." \
    DOCUMENT_INTELLIGENCE_ENDPOINT="..." \
    DOCUMENT_INTELLIGENCE_KEY="..." \
    AZURE_SIGNALR_CONNECTION_STRING="..."
```

---

## Azure Resources

| Resource | Name | Purpose |
|---|---|---|
| Resource Group | `ai-doc-intelligence-rg` | Container for all project resources |
| Storage Account | `aidintelstorage` | Blob Storage for uploaded documents |
| Cosmos DB | `madisengazresume` | NoSQL + vector index for extraction results |
| Document Intelligence | `ai-doc-intelligence` | Azure AI extraction (F0 free tier, 500 pages/month) |
| SignalR Service | `ai-doc-signalr` | Real-time WebSocket push (Free_F1, 20k msg/day) |
| Static Web Apps | `ai-doc-intelligence` | Frontend + Functions hosting (Free tier) |

---

## Author

**Mahlatse Madiseng**
Frontend Engineer · Cloud Solutions Developer · Azure Serverless Specialist

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/mahlatse-madiseng/)