import { app, HttpRequest, HttpResponseInit, InvocationContext, output } from "@azure/functions";
import { BlobService } from "../services/blobService";
import { CosmosService } from "../services/cosmosService";
import { DocumentIntelligenceService } from "../services/documentIntelligenceService";
import { ExtractionResult } from "../services/cosmosService";
import { generateEmbedding } from "../services/embeddingService";
import { extractEmbeddingText } from "../services/fieldExtractor";
import { randomUUID } from "crypto";

let _blobService:   BlobService | null                 = null;
let _cosmosService: CosmosService | null               = null;
let _aiService:     DocumentIntelligenceService | null = null;

function getBlobService()   { return _blobService   ??= new BlobService(); }
function getCosmosService() { return _cosmosService ??= new CosmosService(); }
function getAiService()     { return _aiService     ??= new DocumentIntelligenceService(); }

const signalROutput = output.generic({
    type:                    'signalR',
    name:                    'signalRMessages',
    hubName:                 'docIntelligence',
    connectionStringSetting: 'AZURE_SIGNALR_CONNECTION_STRING',
});

interface EventGridEvent {
    eventType: string;
    data: {
        validationCode?: string;
        url?: string;
        api?: string;
        contentType?: string;
    };
    subject?: string;
}

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://salmon-wave-012e1d61e.7.azurestaticapps.net",
];

export async function processDocumentEventGrid(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`processDocumentEventGrid triggered: ${request.method}`);

    const origin = request.headers.get("origin") ?? "";
    const allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];

    const headers: Record<string, string> = {
        "Content-Type":                 "application/json",
        "Access-Control-Allow-Origin":  allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, aeg-sas-key, aeg-event-type",
    };

    if (request.method === "OPTIONS") {
        return { status: 204, headers };
    }

    try {
        const events = await request.json() as EventGridEvent[];

        // ── Validation handshake ──────────────────────────────────────────
        const validationEvent = events.find(
            e => e.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent"
        );

        if (validationEvent?.data?.validationCode) {
            context.log("Event Grid validation handshake received");
            return {
                status: 200,
                headers,
                jsonBody: { validationResponse: validationEvent.data.validationCode }
            };
        }

        // ── BlobCreated events ────────────────────────────────────────────
        const blobEvents = events.filter(
            e => e.eventType === "Microsoft.Storage.BlobCreated" &&
                 e.data?.api === "PutBlob"
        );

        context.log(`Processing ${blobEvents.length} BlobCreated event(s)`);

        for (const event of blobEvents) {
            try {
                const blobUrl = event.data.url;
                if (!blobUrl) continue;

                const containerName = process.env["STORAGE_CONTAINER_NAME"] ?? "documents";
                const urlParts = blobUrl.split(`/${containerName}/`);
                if (urlParts.length < 2) {
                    context.log(`Could not extract blob name from URL: ${blobUrl}`);
                    continue;
                }

                const blobName     = urlParts[1].split('?')[0];
                const blobParts    = blobName.split('/');
                const documentType = blobParts[0] ?? 'unknown';
                const fileSegment  = blobParts[1] ?? blobName;
                const fileName     = fileSegment.replace(/^\d+-/, '');

                context.log(`Event Grid blob: ${blobName} (type: ${documentType})`);
                await processBlob(blobName, documentType, fileName, context);

            } catch (blobError: any) {
                context.error(`Failed processing blob event:`, blobError);
            }
        }

        return {
            status:   200,
            headers,
            jsonBody: { processed: blobEvents.length }
        };

    } catch (error: any) {
        context.error("processDocumentEventGrid error:", error);
        return {
            status:   200,
            headers,
            jsonBody: { received: true, error: error?.message }
        };
    }
}

async function processBlob(
    blobName: string,
    documentType: string,
    fileName: string,
    context: InvocationContext
): Promise<void> {

    // ── Idempotency check ─────────────────────────────────────────────────
    const existing = await getCosmosService().findByBlobName(blobName);
    if (existing?.status === 'completed') {
        context.log(`Blob already completed, skipping: ${blobName}`);
        return;
    }

    const resultId = existing?.id ?? randomUUID();

    // ── 1. Save processing record immediately ─────────────────────────────
    const processingRecord: ExtractionResult = {
        id:           resultId,
        blobName,
        documentType: documentType as any,
        fileName,
        processedAt:  existing?.processedAt ?? new Date().toISOString(),
        status:       'processing',
        fields:       {},
        pageCount:    0,
    };

    await getCosmosService().saveResult(processingRecord);
    context.log(`Processing record saved: ${resultId}`);

    // Push processing state via SignalR so Angular shows the loading indicator
    context.extraOutputs.set(signalROutput, {
        target:    'documentProcessed',
        arguments: [processingRecord],
    });

    // ── 2. Download blob and run AI extraction ────────────────────────────
    const buffer     = await getBlobService().downloadBlob(blobName);
    const extraction = await getAiService().analyseDocument(buffer, documentType);
    context.log(`Extraction complete. Fields: ${Object.keys(extraction.fields).length}`);

    // ── 3. Generate embedding from high-value fields ──────────────────────
    const embeddingText = extractEmbeddingText({
        ...processingRecord,
        fields: extraction.fields,
    });

    context.log(`Generating embedding for: "${embeddingText.substring(0, 80)}..."`);
    const embedding = await generateEmbedding(embeddingText);
    context.log(`Embedding generated: ${embedding.length} dimensions`);

    // ── 4. Save completed record with embedding ───────────────────────────
    const completedRecord: ExtractionResult = {
        ...processingRecord,
        status:    'completed',
        fields:    extraction.fields,
        pageCount: extraction.pageCount,
        embedding, 
    };

    await getCosmosService().saveResult(completedRecord);
    context.log(`Completed result saved: ${resultId}`);

    // ── 5. Push completed result via SignalR ──────────────────────────────
    context.extraOutputs.set(signalROutput, {
        target:    'documentProcessed',
        arguments: [{
            id:           completedRecord.id,
            blobName:     completedRecord.blobName,
            documentType: completedRecord.documentType,
            fileName:     completedRecord.fileName,
            processedAt:  completedRecord.processedAt,
            status:       completedRecord.status,
            fields:       completedRecord.fields,
            pageCount:    completedRecord.pageCount,
        }],
    });

    context.log(`Completed and pushed via SignalR: ${resultId}`);
}

app.http("process-document-eventgrid", {
    methods:      ["POST", "OPTIONS"],
    authLevel:    "anonymous",
    route:        "process-document-eventgrid",
    extraOutputs: [signalROutput],
    handler:      processDocumentEventGrid,
});