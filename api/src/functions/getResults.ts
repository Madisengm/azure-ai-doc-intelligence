import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosService } from "../services/cosmosService";

const cosmosService = new CosmosService();

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://your-app.azurestaticapps.net",
];

export async function getResults(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log("getResults triggered");

    const origin = request.headers.get("origin") ?? "";
    const allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return { status: 204, headers };
    }

    try {
        const results = await cosmosService.getAllResults();
        context.log(`Returning ${results.length} results`);

        return {
            status: 200,
            headers,
            jsonBody: { results },
        };

    } catch (error: any) {
        context.error("getResults error:", error);
        return {
            status: 500,
            headers,
            jsonBody: { error: "Failed to retrieve results" },
        };
    }
}

app.http("get-results", {
    methods: ["GET", "OPTIONS"],
    authLevel: "anonymous",
    handler: getResults,
});