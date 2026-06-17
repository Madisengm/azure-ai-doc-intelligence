# 🧠 Azure AI Document Intelligence Dashboard

[![Deploy to Azure Static Web Apps](https://github.com/Madisengm/azure-ai-doc-intelligence/actions/workflows/azure-static-web-apps-salmon-wave-012e1d61e.yml/badge.svg)](https://github.com/Madisengm/azure-ai-doc-intelligence/actions)
[![Azure](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure&logoColor=white)](https://salmon-wave-012e1d61e.7.azurestaticapps.net)
[![Angular](https://img.shields.io/badge/Angular-17+-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Azure Functions](https://img.shields.io/badge/Azure_Functions-v4-0062AD?logo=azurefunctions&logoColor=white)](https://learn.microsoft.com/en-us/azure/azure-functions)
[![Cosmos DB](https://img.shields.io/badge/Cosmos_DB-NoSQL-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/cosmos-db)
[![Azure AI](https://img.shields.io/badge/Azure_AI-Document_Intelligence-0078D4?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

> Upload any document — CV, invoice, receipt, certificate, or ID — and have Azure AI extract structured data from it in real time. Built as a cloud portfolio project targeting the AI-200 Azure AI Cloud Developer Associate certification.

**Live site:** [https://salmon-wave-012e1d61e.7.azurestaticapps.net](https://salmon-wave-012e1d61e.7.azurestaticapps.net)

---

## Architecture

```
Browser (Angular 17+)
  │
  │  1. POST /api/get-upload-url → receives SAS URL (5 min, write-only)
  │  2. PUT file directly to Blob Storage via SAS URL (no proxy)
  │  3. POST /api/process-document → triggers AI extraction
  │  4. GET  /api/get-results or /api/results/:id → reads from Cosmos DB
  ▼
Azure Static Web Apps
  ├── Angular 17+ Frontend       (standalone components, signals, lazy routes)
  │
  ├── getUploadUrl Function      (POST) generates SAS token
  ├── processDocument Function   (POST) downloads blob → AI → saves result
  ├── getResults Function        (GET)  all results from Cosmos DB
  └── getResultById Function     (GET)  single result by id
                │
                │  Azure AI Document Intelligence
                │  (prebuilt models per document type)
                │
                ▼
          Azure Cosmos DB        (NoSQL, partition key /id)

GitHub Actions
  └── build + deploy on every push to main
```

---

## The upload flow in detail

The most important architectural decision in this project is that **Angular never uploads files through an Azure Function**. Instead:

1. Angular calls `GET /api/get-upload-url` with the filename and document type
2. The Function generates a **SAS (Shared Access Signature) URL** — a time-limited, permission-scoped URL tied to a specific blob path
3. Angular `PUT`s the file directly to Azure Blob Storage using that SAS URL
4. Angular then calls `POST /api/process-document` with the blob name
5. The Function downloads the blob, sends it to Azure AI Document Intelligence, saves the result to Cosmos DB, and returns the extraction result synchronously

This pattern means the Function never handles binary payloads, upload speed is faster (direct to Azure infrastructure), and the SAS token enforces a 5-minute expiry with create/write-only permissions — the browser cannot read or delete blobs.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Angular 17+ (standalone) | SPA with signals, lazy routes, drag and drop upload |
| Styling | Tailwind CSS 3 | Utility-first responsive design |
| Upload | Azure Blob Storage + SAS | Direct browser-to-storage upload |
| AI extraction | Azure AI Document Intelligence | Prebuilt models for 5 document types |
| Backend | Azure Functions v4 (Node.js) | Serverless API — 4 HTTP-triggered Functions |
| Database | Azure Cosmos DB (NoSQL) | Stores extraction results, partition key `/id` |
| Hosting | Azure Static Web Apps | Unified frontend + API hosting |
| CI/CD | GitHub Actions | Automated build and deployment |
| Language | TypeScript (ES2020) | Frontend and backend |

---

## Document types supported

| Type | Azure AI model used | Fields extracted |
|---|---|---|
| CV / Resume | `prebuilt-document` | Name, skills, experience, education, key-value pairs |
| Invoice | `prebuilt-invoice` | Vendor, amounts, line items, dates, tax |
| Receipt | `prebuilt-receipt` | Merchant, total, items purchased, payment method |
| Certificate | `prebuilt-document` | Title, issuer, holder name, date, key-value pairs |
| ID Document | `prebuilt-idDocument` | Name, date of birth, ID number, nationality |

Each document type maps to the most cost-effective prebuilt model for that use case. The `prebuilt-document` model handles general key-value extraction with layout analysis, while `prebuilt-invoice`, `prebuilt-receipt`, and `prebuilt-idDocument` are domain-specific models trained on those document types.

---

## AZ-204 exam domains this project covers

| AZ-204 Domain | How this project covers it |
|---|---|
| Implement Azure Functions | 4 HTTP-triggered Functions in Node.js v4 programming model |
| Develop solutions using Blob Storage | SAS token generation, direct browser upload, blob download |
| Develop solutions using Cosmos DB | NoSQL document storage, point reads, upsert pattern |
| Implement Azure AI services | Document Intelligence REST API via `@azure/ai-form-recognizer` SDK |
| Implement secure cloud solutions | SAS tokens with scoped permissions, env var secret management |
| Connect to and consume Azure services | Coordinating Blob, Cosmos DB, and AI services in one pipeline |
| Implement API Management | HTTP Functions as REST endpoints with CORS, error handling |

---

## Project Structure

```
azure-ai-doc-intelligence/
├── frontend/                          # Angular 17+ application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── models/
│   │   │   │   │   └── document.model.ts         # ExtractionResult, DocumentType interfaces
│   │   │   │   └── services/
│   │   │   │       ├── api.service.ts             # HTTP calls to all 4 Functions
│   │   │   │       └── upload.service.ts          # SAS upload + process orchestration
│   │   │   ├── features/
│   │   │   │   ├── upload/
│   │   │   │   │   ├── upload.component.ts        # Drag and drop, type selector, progress bar
│   │   │   │   │   └── upload.component.html
│   │   │   │   ├── result/
│   │   │   │   │   ├── result.component.ts        # Field cards, confidence scores, raw JSON toggle
│   │   │   │   │   └── result.component.html
│   │   │   │   └── history/
│   │   │   │       ├── history.component.ts       # All results, 3s poll while processing
│   │   │   │       └── history.component.html
│   │   │   ├── app.component.ts                   # Root nav component
│   │   │   ├── app.config.ts                      # provideHttpClient, provideRouter
│   │   │   └── app.routes.ts                      # Lazy-loaded routes
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.prod.ts
│   │   ├── styles.css
│   │   └── main.ts
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
│   │   │   └── getResultById.ts                  # GET  /api/results/{id}
│   │   └── services/
│   │       ├── blobService.ts                    # Blob download helper
│   │       ├── cosmosService.ts                  # Point reads, upsert
│   │       └── documentIntelligenceService.ts    # AI extraction, model routing
│   ├── host.json
│   ├── local.settings.json                       # ⚠️ git-ignored — never commit
│   ├── local.settings.example.json               # Safe placeholder for contributors
│   └── tsconfig.json                             # target: ES2020
│
├── staticwebapp.config.json           # SWA routing — SPA fallback + API passthrough
└── .github/
    └── workflows/
        └── azure-static-web-apps-salmon-wave-012e1d61e.yml
```

---

## Key Technical Decisions

### SAS-based direct upload
Files are never routed through an Azure Function. The `getUploadUrl` Function generates a Shared Access Signature URL with `cw` (create + write) permissions and a 5-minute expiry. Angular `PUT`s directly to Blob Storage with this URL. This means the Function never handles binary payloads, upload speed is limited only by the client's connection to Azure Blob Storage (not to the Function), and the SAS token is automatically invalid after 5 minutes. Clock skew between the client and Azure is absorbed by setting `startsOn` to 5 minutes in the past.

### HTTP trigger instead of blob trigger
Azure Static Web Apps only supports HTTP-triggered Functions in its managed Functions host. The original blob trigger design (where the Function fired automatically on upload) was replaced with an explicit `POST /api/process-document` call from Angular after the blob upload completes. This is architecturally equivalent — Angular calls it immediately after upload — and has the side benefit of making the processing flow synchronous, so Angular receives the `resultId` directly and can navigate to the result page without polling.

### Prebuilt model routing
Rather than using a single general-purpose model for all document types, the `DocumentIntelligenceService` maps each document type to the most appropriate Azure AI prebuilt model at the point of analysis. This improves field extraction accuracy — `prebuilt-invoice` is trained specifically on invoices and returns structured line items and amounts that `prebuilt-document` would miss.

### Standalone Angular components with lazy routes
All three feature components (upload, result, history) are lazy-loaded via the Angular router. This means the initial bundle only includes the shell component and routing infrastructure — each feature module loads on demand. Combined with standalone components (no NgModule), the build output is fully tree-shaken per component.

### Confidence score display
Every extracted field includes a confidence score between 0 and 1 returned by the Azure AI model. Fields are sorted by confidence descending and displayed with colour-coded badges (green ≥ 80%, orange ≥ 50%, red < 50%). This makes the extraction quality immediately visible to the user and is directly relevant to production use cases where low-confidence fields need manual review.

---

## Running Locally

### Prerequisites

- Node.js 18+
- Angular CLI: `npm install -g @angular/cli`
- Azure Functions Core Tools v4: `npm install -g azure-functions-core-tools@4`
- An Azure account with Blob Storage, Cosmos DB, and Document Intelligence resources

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

Edit `local.settings.json` with your real values:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_ACCOUNT": "DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net",
    "STORAGE_ACCOUNT_NAME": "YOUR_STORAGE_ACCOUNT_NAME",
    "STORAGE_ACCOUNT_KEY": "YOUR_STORAGE_KEY",
    "STORAGE_CONTAINER_NAME": "documents",
    "COSMOS_DB_ENDPOINT": "https://YOUR_ACCOUNT.documents.azure.com:443/",
    "COSMOS_DB_KEY": "YOUR_COSMOS_KEY",
    "COSMOS_DB_DATABASE": "YOUR_DATABASE_NAME",
    "COSMOS_DB_CONTAINER": "results",
    "DOCUMENT_INTELLIGENCE_ENDPOINT": "https://YOUR_RESOURCE.cognitiveservices.azure.com/",
    "DOCUMENT_INTELLIGENCE_KEY": "YOUR_KEY"
  }
}
```

### 3. Start the API

```bash
cd api
npm install
npm run start
# Functions host starts on http://localhost:7071
```

You should see all four Functions registered:
```
Functions:
  get-result-by-id: [GET,OPTIONS]  http://localhost:7071/api/results/{id}
  get-results:      [GET,OPTIONS]  http://localhost:7071/api/get-results
  get-upload-url:   [POST,OPTIONS] http://localhost:7071/api/get-upload-url
  process-document: [POST,OPTIONS] http://localhost:7071/api/process-document
```

### 4. Start the frontend

```bash
cd frontend
npm install
ng serve
# Angular dev server starts on http://localhost:4200
```

The Angular proxy forwards all `/api/*` requests to the Functions host.

### 5. Configure Blob Storage CORS for local development

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

---

## API Reference

### `POST /api/get-upload-url`

Generates a SAS URL for direct browser upload to Blob Storage.

**Request body**
```json
{
  "fileName": "my-cv.pdf",
  "fileType": "application/pdf",
  "documentType": "cv"
}
```

**Response**
```json
{
  "sasUrl": "https://storage.blob.core.windows.net/documents/cv/1234-my-cv.pdf?sv=...&sp=cw",
  "blobName": "cv/1234-my-cv.pdf",
  "documentType": "cv"
}
```

---

### `POST /api/process-document`

Downloads the blob, runs Azure AI extraction, saves to Cosmos DB, and returns the result.

**Request body**
```json
{
  "blobName": "cv/1234-my-cv.pdf",
  "documentType": "cv"
}
```

**Response**
```json
{
  "id": "uuid",
  "status": "completed"
}
```

---

### `GET /api/get-results`

Returns all extraction results ordered by `processedAt` descending.

**Response**
```json
{
  "results": [
    {
      "id": "uuid",
      "fileName": "my-cv.pdf",
      "documentType": "cv",
      "status": "completed",
      "processedAt": "2026-06-05T11:32:16Z",
      "pageCount": 1,
      "fields": {
        "Name": { "value": "Mahlatse Madiseng", "confidence": 0.95 }
      }
    }
  ]
}
```

---

### `GET /api/results/{id}`

Returns a single extraction result by id.

---

## Deployment

Deployment is fully automated via GitHub Actions. Every push to `main` builds the Angular app, compiles the TypeScript Functions, and deploys both to Azure Static Web Apps.

Environment variables are stored as Azure Static Web Apps application settings and are never committed to the repository.

To update app settings:

```bash
az staticwebapp appsettings set \
  --name ai-doc-intelligence \
  --setting-names \
    STORAGE_ACCOUNT="..." \
    COSMOS_DB_ENDPOINT="..." \
    COSMOS_DB_KEY="..." \
    DOCUMENT_INTELLIGENCE_ENDPOINT="..." \
    DOCUMENT_INTELLIGENCE_KEY="..."
```

---

## Azure Resources

| Resource | Name | Purpose |
|---|---|---|
| Resource Group | `ai-doc-intelligence-rg` | Container for all project resources |
| Storage Account | `aidintelstorage` | Blob Storage for uploaded documents |
| Cosmos DB | `madisengazresume` | NoSQL storage for extraction results |
| Document Intelligence | `ai-doc-intelligence` | Azure AI extraction service (F0 free tier) |
| Static Web Apps | `ai-doc-intelligence` | Frontend + Functions hosting |

---

## Author

**Mahlatse Madiseng**
Frontend Engineer · Cloud Solutions Developer · Azure Serverless Specialist

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/mahlatse-madiseng/)