import { app, InvocationContext } from "@azure/functions";
import { BlobService } from "../services/blobService";
import { CosmosService } from "../services/cosmosService";
import { DocumentIntelligenceService } from "../services/documentIntelligenceService";
import { ExtractionResult } from "../services/cosmosService";
import { randomUUID } from "crypto";

const blobService   = new BlobService();
const cosmosService = new CosmosService();
const aiService     = new DocumentIntelligenceService();

export async function processDocument(
    blob: Buffer,
    context: InvocationContext
): Promise<void> {
    const blobName = context.triggerMetadata?.["name"] as string;
    context.log(`processDocument triggered for blob: ${blobName}`);

    const blobParts    = blobName.split('/');
    const documentType = blobParts[0] ?? 'unknown';
    const fileSegment  = blobParts[1] ?? blobName;
    const fileName     = fileSegment.replace(/^\d+-/, '');
    const resultId     = randomUUID();

    const extension = fileName.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
        pdf:  'application/pdf',
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        png:  'image/png',
        tiff: 'image/tiff',
    };
    const contentType = contentTypeMap[extension ?? ''] ?? 'application/pdf';

    const processingRecord: ExtractionResult = {
        id:           resultId,
        blobName,
        documentType,
        fileName,
        processedAt:  new Date().toISOString(),
        status:       'processing',
        fields:       {},
        pageCount:    0,
    };

    await cosmosService.saveResult(processingRecord);
    context.log(`Processing record saved with id: ${resultId}`);

    try {
        context.log(`Sending to Document Intelligence — model based on type: ${documentType}`);
        const extraction = await aiService.analyseDocument(blob, documentType);
        context.log(`Extraction complete. Fields found: ${Object.keys(extraction.fields).length}`);

        const completedRecord: ExtractionResult = {
            ...processingRecord,
            status:    'completed',
            fields:    extraction.fields,
            pageCount: extraction.pageCount,
        };

        await cosmosService.saveResult(completedRecord);
        context.log(`Completed result saved for: ${fileName}`);

    } catch (error: any) {
        context.error(`Document Intelligence failed for ${blobName}:`, error);

        await cosmosService.saveResult({
            ...processingRecord,
            status: 'failed',
            error:  error?.message ?? 'Unknown processing error',
        });
    }
}

app.storageBlob("process-document", {
    path: `${process.env["STORAGE_CONTAINER_NAME"] ?? "documents"}/{name}`,
    connection: "STORAGE_ACCOUNT",
    handler: processDocument,
});