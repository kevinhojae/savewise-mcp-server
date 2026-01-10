import "dotenv/config";
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
