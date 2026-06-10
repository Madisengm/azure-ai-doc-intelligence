import { app, HttpRequest, HttpResponseInit, InvocationContext, output } from "@azure/functions";
import { BlobService } from "../services/blobService";
import { CosmosService } from "../services/cosmosService";
import { DocumentIntelligenceService } from "../services/documentIntelligenceService";
import { ExtractionResult } from "../services/cosmosService";
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

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://salmon-wave-012e1d61e.7.azurestaticapps.net",
];

export async function processDocument(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`processDocument triggered: ${request.method}`);

    const origin = request.headers.get("origin") ?? "";
    const allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];

    const headers: Record<string, string> = {
        "Content-Type":                 "application/json",
        "Access-Control-Allow-Origin":  allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return { status: 204, headers };
    }

    try {
        const body = await request.json() as {
            blobName:     string;
            documentType: string;
        };

        const { blobName, documentType } = body;

        if (!blobName || !documentType) {
            return {
                status: 400,
                headers,
                jsonBody: { error: "blobName and documentType are required" }
            };
        }

        const fileSegment = blobName.split('/')[1] ?? blobName;
        const fileName    = fileSegment.replace(/^\d+-/, '');
        const resultId    = randomUUID();

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

        context.extraOutputs.set(signalROutput, {
            target:    'documentProcessed',
            arguments: [processingRecord],
        });

        const buffer    = await blobService.downloadBlob(blobName);
        const extraction = await aiService.analyseDocument(buffer, documentType);
        context.log(`Extraction complete. Fields: ${Object.keys(extraction.fields).length}`);

        const completedRecord: ExtractionResult = {
            ...processingRecord,
            status:    'completed',
            fields:    extraction.fields,
            pageCount: extraction.pageCount,
        };

        await cosmosService.saveResult(completedRecord);
        context.log(`Completed result saved: ${resultId}`);

        context.extraOutputs.set(signalROutput, {
            target:    'documentProcessed',
            arguments: [completedRecord],
        });

        return {
            status:   200,
            headers,
            jsonBody: { id: resultId, status: 'completed' }
        };

    } catch (error: any) {
        context.error("processDocument error:", error);
        return {
            status:   500,
            headers,
            jsonBody: { error: error?.message ?? "Processing failed" }
        };
    }
}

app.http("process-document", {
    methods:      ["POST", "OPTIONS"],
    authLevel:    "anonymous",
    extraOutputs: [signalROutput],
    handler:      processDocument,
});