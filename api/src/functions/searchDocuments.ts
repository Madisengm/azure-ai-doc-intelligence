import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosService } from "../services/cosmosService";
import { generateEmbedding } from "../services/embeddingService";

const cosmosService = new CosmosService();

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://salmon-wave-012e1d61e.7.azurestaticapps.net",
];

export async function searchDocuments(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log("searchDocuments triggered");

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
        const body = await request.json() as { query: string };
        const { query } = body;

        if (!query?.trim()) {
            return {
                status: 400,
                headers,
                jsonBody: { error: "query is required" }
            };
        }

        context.log(`Semantic search for: "${query}"`);

        const queryEmbedding = await generateEmbedding(query);
        const results = await cosmosService.vectorSearch(
            queryEmbedding,
            'non-existent-id', 
            10
        );

        context.log(`Search returned ${results.length} results`);

        return {
            status: 200,
            headers,
            jsonBody: { results },
        };

    } catch (error: any) {
        context.error("searchDocuments error:", error);
        return {
            status: 500,
            headers,
            jsonBody: { error: "Search failed" }
        };
    }
}

app.http("search-documents", {
    methods:   ["POST", "OPTIONS"],
    authLevel: "anonymous",
    handler:   searchDocuments,
});