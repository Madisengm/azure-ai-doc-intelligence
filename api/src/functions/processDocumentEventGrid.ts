import { app, HttpRequest, HttpResponseInit, InvocationContext, output } from "@azure/functions";
import { BlobService } from "../services/blobService";
import { CosmosService } from "../services/cosmosService";
import { DocumentIntelligenceService } from "../services/documentIntelligenceService";
import { ExtractionResult } from "../services/cosmosService";
import { extractEmbeddingText } from "../services/fieldExtractor";
import { generateEmbedding } from "../services/embeddingService";
import { randomUUID } from "crypto";

const blobService   = new BlobService();
const cosmosService = new CosmosService();
const aiService     = new DocumentIntelligenceService();

const signalROutput = output.generic({
    type:                    'signalR',
    name:                    'signalRMessages',
    hubName:                 'docIntelligence',
    connectionStringSetting: 'AZURE_SIGNALR_CONNECTION_STRING',
});

// Event Grid delivers events as an array of objects
interface EventGridEvent {
    eventType: string;
    data: {
        // Validation handshake
        validationCode?: string;
        // BlobCreated event
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
        // Event Grid sends this once when the subscription is created.
        // We must echo back the validationCode to confirm the endpoint.
        const validationEvent = events.find(
            e => e.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent"
        );

        if (validationEvent?.data?.validationCode) {
            context.log("Event Grid validation handshake received");
            return {
                status: 200,
                headers,
                jsonBody: {
                    validationResponse: validationEvent.data.validationCode
                }
            };
        }

        // ── BlobCreated events ────────────────────────────────────────────
        const blobEvents = events.filter(
            e => e.eventType === "Microsoft.Storage.BlobCreated" &&
                 e.data?.api === "PutBlob"
        );

        context.log(`Processing ${blobEvents.length} BlobCreated event(s)`);

        for (const event of blobEvents) {
            const blobUrl = event.data.url;
            if (!blobUrl) continue;

            // Extract blob name from URL:
            // https://aidintelstorage.blob.core.windows.net/documents/cv/1234-file.pdf
            // → cv/1234-file.pdf
            const containerName = process.env["STORAGE_CONTAINER_NAME"] ?? "documents";
            const urlParts = blobUrl.split(`/${containerName}/`);
            if (urlParts.length < 2) {
                context.log(`Could not extract blob name from URL: ${blobUrl}`);
                continue;
            }

            // Remove cache-buster query string if present
            const blobName = urlParts[1].split('?')[0];

            // Derive document type and file name from blob path
            // Blob structure: documentType/timestamp-fileName.ext
            const blobParts    = blobName.split('/');
            const documentType = blobParts[0] ?? 'unknown';
            const fileSegment  = blobParts[1] ?? blobName;
            const fileName     = fileSegment.replace(/^\d+-/, '');

            context.log(`Event Grid blob: ${blobName} (type: ${documentType})`);

            await processBlob(
                blobName,
                documentType,
                fileName,
                context,
                headers
            );
        }

        return { status: 200, headers, jsonBody: { processed: blobEvents.length } };

    } catch (error: any) {
        context.error("processDocumentEventGrid error:", error);
        return {
            status: 500,
            headers,
            jsonBody: { error: error?.message ?? "Event processing failed" }
        };
    }
}

async function processBlob(
    blobName: string,
    documentType: string,
    fileName: string,
    context: InvocationContext,
    headers: Record<string, string>
): Promise<void> {
    const resultId = randomUUID();

    const processingRecord: ExtractionResult = {
        id:           resultId,
        blobName,
        documentType: documentType as any,
        fileName,
        processedAt:  new Date().toISOString(),
        status:       'processing',
        fields:       {},
        pageCount:    0,
    };

    await cosmosService.saveResult(processingRecord);
    context.log(`Processing record saved: ${resultId}`);

    // Push processing state via SignalR
    context.extraOutputs.set(signalROutput, {
        target:    'documentProcessed',
        arguments: [processingRecord],
    });

    const buffer     = await blobService.downloadBlob(blobName);
    const extraction = await aiService.analyseDocument(buffer, documentType);
    context.log(`Extraction complete. Fields: ${Object.keys(extraction.fields).length}`);

    const embeddingText = extractEmbeddingText({
        ...processingRecord,
        fields: extraction.fields,
    });
    const embedding = await generateEmbedding(embeddingText);

    const completedRecord: ExtractionResult = {
        ...processingRecord,
        status:    'completed',
        fields:    extraction.fields,
        pageCount: extraction.pageCount,
        embedding,
    };

    await cosmosService.saveResult(completedRecord);

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

    context.log(`Completed result saved and pushed: ${resultId}`);
}

app.http("process-document-eventgrid", {
    methods:      ["POST", "OPTIONS"],
    authLevel:    "anonymous",
    route:        "process-document-eventgrid",
    extraOutputs: [signalROutput],
    handler:      processDocumentEventGrid,
});