// Load dotenv only in development (not available in production)
if (process.env.NODE_ENV !== "production") {
  import("dotenv/config").catch(() => {
    // dotenv not available, using environment variables directly
  });
}

import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./server.js";
import { bearerAuth } from "./middleware/auth.js";

const PORT = parseInt(process.env.PORT || "8080", 10);
const MCP_PATH = process.env.MCP_PATH || "/mcp";

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log(`  Headers: ${JSON.stringify(req.headers)}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`  Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

// Health check endpoint (no auth required)
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// OAuth2 endpoints for Claude Code MCP authentication
// OAuth server metadata - support multiple path patterns
const oauthMetadataHandler = (req: Request, res: Response) => {
  const baseUrl = `https://${req.get("host")}`;
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
};

app.get("/.well-known/oauth-authorization-server", oauthMetadataHandler);
app.get("/.well-known/oauth-authorization-server/mcp", oauthMetadataHandler);
app.get("/.well-known/openid-configuration", oauthMetadataHandler);
app.get("/.well-known/openid-configuration/mcp", oauthMetadataHandler);
app.get("/mcp/.well-known/openid-configuration", oauthMetadataHandler);

// OAuth protected resource metadata
const protectedResourceHandler = (req: Request, res: Response) => {
  const baseUrl = `https://${req.get("host")}`;
  res.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ["header"],
  });
};

app.get("/.well-known/oauth-protected-resource", protectedResourceHandler);
app.get("/.well-known/oauth-protected-resource/mcp", protectedResourceHandler);

// Dynamic client registration - support both GET and POST
app.get("/register", (_req: Request, res: Response) => {
  // Return a default client registration for GET requests
  const clientId = randomUUID();
  res.json({
    client_id: clientId,
    client_secret_expires_at: 0,
    redirect_uris: [],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
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

// Token endpoint - exchange code for access token (support GET and POST)
const handleToken = (_req: Request, res: Response) => {
  const expectedToken = process.env.MCP_BEARER_TOKEN;

  // Return the configured bearer token as the access token
  res.json({
    access_token: expectedToken || randomUUID(),
    token_type: "Bearer",
    expires_in: 3600 * 24 * 365, // 1 year
    refresh_token: randomUUID(),
  });
};

app.get("/token", handleToken);
app.post("/token", handleToken);

// Session management for MCP
interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
}

const sessions = new Map<string, McpSession>();

// Clean up old sessions (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      sessions.delete(sessionId);
      console.log(`Cleaned up session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000);

// MCP endpoint with session management
app.post(MCP_PATH, bearerAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string;

    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      // Create new session
      const newSessionId = randomUUID();
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });

      await server.connect(transport);

      session = { server, transport, createdAt: Date.now() };
      sessions.set(newSessionId, session);
      console.log(`Created new session: ${newSessionId}`);
    }

    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Handle GET for SSE streaming
app.get(MCP_PATH, bearerAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string;

    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session) {
      // Create new session for GET requests too
      const newSessionId = randomUUID();
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });

      await server.connect(transport);

      session = { server, transport, createdAt: Date.now() };
      sessions.set(newSessionId, session);
    }

    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP GET request error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
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
