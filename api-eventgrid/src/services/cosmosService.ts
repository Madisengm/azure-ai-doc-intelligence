import { CosmosClient, Container } from "@azure/cosmos";

export interface ExtractionResult {
    id:           string;
    blobName:     string;
    documentType: string;
    fileName:     string;
    processedAt:  string;
    status:       'processing' | 'completed' | 'failed';
    fields:       Record<string, { value: string | null; confidence: number }>;
    pageCount:    number;
    error?:       string;
    embedding?:   number[];
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
                "SELECT c.id, c.blobName, c.documentType, c.fileName, c.processedAt, c.status, c.fields, c.pageCount, c.error FROM c ORDER BY c.processedAt DESC"
            )
            .fetchAll();
        return resources;
    }

    async vectorSearch(
        embedding: number[],
        excludeId: string,
        topK: number = 5
    ): Promise<ExtractionResult[]> {
        const query = {
            query: `
                SELECT TOP @topK
                    c.id, c.blobName, c.documentType, c.fileName,
                    c.processedAt, c.status, c.fields, c.pageCount,
                    VectorDistance(c.embedding, @embedding) AS similarityScore
                FROM c
                WHERE c.id != @excludeId
                AND c.status = 'completed'
                AND IS_ARRAY(c.embedding)
                ORDER BY VectorDistance(c.embedding, @embedding)
            `,
            parameters: [
                { name: '@embedding', value: embedding },
                { name: '@excludeId', value: excludeId },
                { name: '@topK',      value: topK },
            ],
        };

        const { resources } = await this.container.items
            .query<ExtractionResult & { similarityScore: number }>(query)
            .fetchAll();

        return resources;
    }

    async findByBlobName(blobName: string): Promise<ExtractionResult | undefined> {
        const { resources } = await this.container.items
            .query<ExtractionResult>({
                query: "SELECT TOP 1 c.id, c.status, c.processedAt FROM c WHERE c.blobName = @blobName",
                parameters: [{ name: "@blobName", value: blobName }]
            })
            .fetchAll();
        return resources[0];
    }
}