import { app, HttpRequest, HttpResponseInit, InvocationContext, input } from "@azure/functions";

const signalRConnectionInfo = input.generic({
    type:                      'signalRConnectionInfo',
    name:                      'connectionInfo',
    hubName:                   'docIntelligence',
    connectionStringSetting:   'AZURE_SIGNALR_CONNECTION_STRING',
});

const ALLOWED_ORIGINS = [
    "http://localhost:4200",
    "https://salmon-wave-012e1d61e.7.azurestaticapps.net",
];

export async function signalrNegotiate(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log("signalrNegotiate triggered");

    const origin = request.headers.get("origin") ?? "";
    const allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0];

    const headers: Record<string, string> = {
        "Content-Type":                  "application/json",
        "Access-Control-Allow-Origin":   allowedOrigin,
        "Access-Control-Allow-Methods":  "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":  "Content-Type, x-requested-with",
    };

    if (request.method === "OPTIONS") {
        return { status: 204, headers };
    }

    try {
        const connectionInfo = context.extraInputs.get(signalRConnectionInfo);

        if (!connectionInfo) {
            context.error("SignalR connection info is empty — check AZURE_SIGNALR_CONNECTION_STRING");
            return {
                status: 500,
                headers,
                jsonBody: { error: "Failed to get SignalR connection info" }
            };
        }

        context.log("SignalR connection info returned successfully");
        return {
            status: 200,
            headers,
            jsonBody: connectionInfo
        };

    } catch (error: any) {
        context.error("signalrNegotiate error:", error);
        return {
            status: 500,
            headers,
            jsonBody: { error: "Failed to negotiate SignalR connection" }
        };
    }
}

app.http("signalr-negotiate", {
    methods:      ["GET", "POST", "OPTIONS"],
    authLevel:    "anonymous",
    route:        "negotiate",
    extraInputs:  [signalRConnectionInfo],
    handler:      signalrNegotiate,
});