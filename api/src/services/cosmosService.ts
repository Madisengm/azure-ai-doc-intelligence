import { CosmosClient, Container } from "@azure/cosmos";

export interface ExtractionResult {
    id: string;
    blobName: string;
    documentType: string;
    fileName: string;
    processedAt: string;
    status: 'processing' | 'completed' | 'failed';
    fields: Record<string, {
        value: string | null;
        confidence: number;
    }>;
    pageCount: number;
    error?: string;
}

export class CosmosService {
    private container: Container;

    constructor() {
        const endpoint    = process.env["COSMOS_DB_ENDPOINT"];
        const key         = process.env["COSMOS_DB_KEY"];
        const databaseId  = process.env["COSMOS_DB_DATABASE"];
        const containerId = process.env["COSMOS_DB_CONTAINER"];

        if (!endpoint || !key || !databaseId || !containerId) {
            throw new Error(
                "Missing Cosmos DB env vars: " +
                "COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE, COSMOS_DB_CONTAINER"
            );
        }

        const client = new CosmosClient({ endpoint, key });
        this.container = client.database(databaseId).container(containerId);
    }

    async saveResult(result: ExtractionResult): Promise<ExtractionResult> {
        const { resource } = await this.container.items.upsert<ExtractionResult>(result);
        if (!resource) throw new Error("Failed to save extraction result");
        return resource;
    }

    async getResultById(id: string): Promise<ExtractionResult | undefined> {
        const { resource } = await this.container
            .item(id, id)
            .read<ExtractionResult>();
        return resource;
    }

    async getAllResults(): Promise<ExtractionResult[]> {
        const { resources } = await this.container.items
            .query<ExtractionResult>(
                "SELECT * FROM c ORDER BY c.processedAt DESC"
            )
            .fetchAll();
        return resources;
    }
}