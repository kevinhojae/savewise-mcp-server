import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleSavewise } from "./tools/savewise.js";
import { HighlightSchema } from "./types/highlight.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "savewise-mcp-server",
    version: "1.0.0",
  });

  server.tool(
    "readwise_save_highlights",
    "대화에서 추출한 하이라이트를 Readwise에 저장합니다. 핵심 인사이트, 결정사항, 명령어, 주의사항 등을 저장할 때 사용합니다.",
    {
      highlights: z
        .array(HighlightSchema)
        .min(1)
        .describe("저장할 하이라이트 배열"),
    },
    async (args) => {
      return handleSavewise(args);
    }
  );

  return server;
}
