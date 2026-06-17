import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosService } from "../services/cosmosService";

const cosmosService = new CosmosService();

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://salmon-wave-012e1d61e.7.azurestaticapps.net",
];

export async function findSimilar(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log("findSimilar triggered");

    const origin = request.headers.get("origin") ?? "";
    const allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];

    const headers: Record<string, string> = {
        "Content-Type":                 "application/json",
        "Access-Control-Allow-Origin":  allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return { status: 204, headers };
    }

    try {
        const id = request.params["id"];
        if (!id) {
            return { status: 400, headers, jsonBody: { error: "id is required" } };
        }

        const source = await cosmosService.getResultById(id);

        if (!source) {
            return { status: 404, headers, jsonBody: { error: "Document not found" } };
        }

        if (!source.embedding || source.embedding.length === 0) {
            return {
                status: 422,
                headers,
                jsonBody: { error: "This document has no embedding. Re-upload it to generate one." }
            };
        }

        const similar = await cosmosService.vectorSearch(source.embedding, id, 5);
        context.log(`Found ${similar.length} similar documents for id: ${id}`);

        return {
            status: 200,
            headers,
            jsonBody: { results: similar },
        };

    } catch (error: any) {
        context.error("findSimilar error:", error);
        return {
            status: 500,
            headers,
            jsonBody: { error: "Failed to find similar documents" }
        };
    }
}

app.http("find-similar", {
    methods:   ["GET", "OPTIONS"],
    authLevel: "anonymous",
    route:     "find-similar/{id}",
    handler:   findSimilar,
});