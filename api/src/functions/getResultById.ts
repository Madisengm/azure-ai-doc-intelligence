import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosService } from "../services/cosmosService";

const cosmosService = new CosmosService();

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://your-app.azurestaticapps.net",
];

export async function getResultById(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log("getResultById triggered");

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
        const id = request.params["id"];

        if (!id) {
            return {
                status: 400,
                headers,
                jsonBody: { error: "Result ID is required" },
            };
        }

        const result = await cosmosService.getResultById(id);

        if (!result) {
            return {
                status: 404,
                headers,
                jsonBody: { error: `No result found for id: ${id}` },
            };
        }

        return {
            status: 200,
            headers,
            jsonBody: result,
        };

    } catch (error: any) {
        context.error("getResultById error:", error);
        return {
            status: 500,
            headers,
            jsonBody: { error: "Failed to retrieve result" },
        };
    }
}

app.http("get-result-by-id", {
    methods: ["GET", "OPTIONS"],
    authLevel: "anonymous",
    route: "results/{id}", 
    handler: getResultById,
});