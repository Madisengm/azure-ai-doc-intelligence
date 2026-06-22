import {
    BlobServiceClient,
    StorageSharedKeyCredential,
} from "@azure/storage-blob";

export class BlobService {
    private client: BlobServiceClient;
    private containerName: string;

    constructor() {
        const accountName = process.env["STORAGE_ACCOUNT_NAME"];
        const accountKey  = process.env["STORAGE_ACCOUNT_KEY"];
        const container   = process.env["STORAGE_CONTAINER_NAME"];

        if (!accountName || !accountKey || !container) {
            throw new Error(
                "Missing Blob Storage env vars: " +
                "STORAGE_ACCOUNT_NAME, STORAGE_ACCOUNT_KEY, STORAGE_CONTAINER_NAME"
            );
        }

        const credential  = new StorageSharedKeyCredential(accountName, accountKey);
        this.client       = new BlobServiceClient(
            `https://${accountName}.blob.core.windows.net`,
            credential
        );
        this.containerName = container;
    }

    /** Get blob metadata — used by the Blob trigger to read file details */
    async getBlobMetadata(blobName: string) {
        const containerClient = this.client.getContainerClient(this.containerName);
        const blobClient      = containerClient.getBlobClient(blobName);
        return await blobClient.getProperties();
    }

    /** Download blob as Buffer — passed to Document Intelligence */
    async downloadBlob(blobName: string): Promise<Buffer> {
        const containerClient = this.client.getContainerClient(this.containerName);
        const blobClient      = containerClient.getBlobClient(blobName);
        const downloadResponse = await blobClient.download();

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const stream = downloadResponse.readableStreamBody!;
            stream.on('data',  (chunk) => chunks.push(Buffer.from(chunk)));
            stream.on('end',   () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }

    /** Delete a blob after processing — optional cleanup */
    async deleteBlob(blobName: string): Promise<void> {
        const containerClient = this.client.getContainerClient(this.containerName);
        await containerClient.deleteBlob(blobName);
    }
}