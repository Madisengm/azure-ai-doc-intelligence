import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from "@azure/storage-blob";

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://salmon-wave-012e1d61e.7.azurestaticapps.net",
];

const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/tiff",
];

export async function getUploadUrl(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`getUploadUrl triggered: ${request.method}`);

    const origin = request.headers.get("origin") ?? "";
    const allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return { status: 204, headers };
    }

    try {
        const body = await request.json() as {
            fileName: string;
            fileType: string;
            documentType: string;
        };

        const { fileName, fileType, documentType } = body;

        if (!ALLOWED_TYPES.includes(fileType)) {
            return {
                status: 400,
                headers,
                jsonBody: {
                    error: `File type '${fileType}' is not supported. Allowed types: PDF, JPEG, PNG, TIFF`
                }
            };
        }

        if (!fileName || !documentType) {
            return {
                status: 400,
                headers,
                jsonBody: { error: "fileName and documentType are required" }
            };
        }

        const timestamp  = Date.now();
        const safeName   = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const blobName   = `${documentType}/${timestamp}-${safeName}`;

        const accountName = process.env["STORAGE_ACCOUNT_NAME"]!;
        const accountKey  = process.env["STORAGE_ACCOUNT_KEY"]!;
        const container   = process.env["STORAGE_CONTAINER_NAME"]!;

        const credential  = new StorageSharedKeyCredential(accountName, accountKey);
        const sasParams   = generateBlobSASQueryParameters(
            {
                containerName:  container,
                blobName:       blobName,
                permissions:    BlobSASPermissions.parse("cw"),
                startsOn:       new Date(Date.now() - 5 * 60 * 1000),
                expiresOn:      new Date(Date.now() + 10 * 60 * 1000),
            },
            credential
        );

        const sasUrl = `https://${accountName}.blob.core.windows.net/${container}/${blobName}?${sasParams.toString()}`;

        context.log(`SAS URL generated for blob: ${blobName}`);

        return {
            status: 200,
            headers,
            jsonBody: {
                sasUrl,
                blobName,
                documentType,
            }
        };

    } catch (error) {
        context.error("getUploadUrl error:", error);
        return {
            status: 500,
            headers,
            jsonBody: { error: "Failed to generate upload URL" }
        };
    }
}

app.http("get-upload-url", {
    methods: ["POST", "OPTIONS"],
    authLevel: "anonymous",
    handler: getUploadUrl,
});