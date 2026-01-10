// Load dotenv only in development (not available in production)
if (process.env.NODE_ENV !== "production") {
  import("dotenv/config").catch(() => {
    // dotenv not available, using environment variables directly
  });
}

import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { bearerAuth } from "./middleware/auth.js";

const PORT = parseInt(process.env.PORT || "8080", 10);
const MCP_PATH = process.env.MCP_PATH || "/mcp";

const app = express();
app.use(express.json());

// Health check endpoint (no auth required)
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// OAuth2 endpoints for Claude Code MCP authentication
// OAuth server metadata
app.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
  const baseUrl = `${_req.protocol}://${_req.get("host")}`;
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// Dynamic client registration - support both GET and POST
app.get("/register", (_req: Request, res: Response) => {
  // Return registration endpoint info
  res.json({
    registration_endpoint: `${_req.protocol}://${_req.get("host")}/register`,
    registration_endpoint_auth_methods_supported: ["none"],
  });
});

app.post("/register", (_req: Request, res: Response) => {
  const clientId = randomUUID();
  res.status(201).json({
    client_id: clientId,
    client_secret_expires_at: 0,
    redirect_uris: _req.body.redirect_uris || [],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});

// Authorization endpoint - auto-approve and redirect with code
app.get("/authorize", (req: Request, res: Response) => {
  const { redirect_uri, state, code_challenge } = req.query;

  if (!redirect_uri) {
    res.status(400).json({ error: "missing_redirect_uri" });
    return;
  }

  // Generate authorization code (we'll use the code_challenge as reference)
  const code = Buffer.from(JSON.stringify({
    challenge: code_challenge,
    timestamp: Date.now()
  })).toString("base64url");

  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state as string);

  res.redirect(redirectUrl.toString());
});

// Token endpoint - exchange code for access token
app.post("/token", (_req: Request, res: Response) => {
  const expectedToken = process.env.MCP_BEARER_TOKEN;

  // Return the configured bearer token as the access token
  res.json({
    access_token: expectedToken || randomUUID(),
    token_type: "Bearer",
    expires_in: 3600 * 24 * 365, // 1 year
    refresh_token: randomUUID(),
  });
});

// MCP endpoint with authentication
app.post(MCP_PATH, bearerAuth, async (req: Request, res: Response) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Handle SSE for streaming responses
app.get(MCP_PATH, bearerAuth, async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // For now, just acknowledge the connection
  res.write("data: {\"type\":\"connected\"}\n\n");
});

// Handle DELETE for session cleanup
app.delete(MCP_PATH, bearerAuth, async (_req: Request, res: Response) => {
  res.status(200).json({ status: "session closed" });
});

app.listen(PORT, () => {
  console.log(`Savewise MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: ${MCP_PATH}`);
  console.log(`Health check: /healthz`);
});
