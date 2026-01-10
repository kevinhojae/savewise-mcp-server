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
    `대화에서 추출한 하이라이트를 Readwise에 저장합니다.

## 저장 대상
- 개념 설명 (정의, 목적, 사용 시점, 주의점)
- 기술적 결정과 그 이유
- 단계별 구현/설정 방법
- 트레이드오프 분석 및 비교
- 실용적 팁과 베스트 프랙티스

## 좋은 하이라이트를 위한 요소
다음 요소가 포함되면 더 가치 있는 하이라이트가 됩니다:

1. **대화 맥락**: 사용자가 왜 이 질문을 했는지, 어떤 문제를 해결하려 했는지
2. **의도와 목적**: 이 정보가 왜 필요한지, 어떤 상황에서 유용한지
3. **구체적 예시**: 실제 코드, 명령어, 설정값 등 바로 적용 가능한 예시
4. **판단 근거**: 왜 이 방법을 선택했는지, 다른 대안과의 비교

## 세분도 가이드라인
하이라이트는 **하나의 개념/주제**를 **완결된 형태**로 담아야 합니다.

### 좋은 예시 (높은 세분도)
- "[맥락: MCP 서버에서 OAuth 없이 간단히 인증하고 싶음] Readwise API 인증 방법: Authorization 헤더에 'Token <access_token>' 형식으로 전달. 환경변수 READWISE_TOKEN에 저장하고 서버에서 읽어 사용. 예시: headers: { Authorization: \`Token \${process.env.READWISE_TOKEN}\` }. 주의: 토큰이 클라이언트에 노출되지 않도록 서버 사이드에서만 사용할 것."
- "[맥락: 여러 프런트엔드가 각기 다른 데이터 형식을 요구함] BFF란? 특정 프런트엔드를 위한 맞춤형 백엔드 레이어. 클라이언트별 데이터 조합, DTO 변환, 인증 처리를 담당. 예시: 모바일 앱용 BFF는 이미지를 압축해서 전달, 웹용 BFF는 풀사이즈 제공. API Gateway와 차이: Gateway는 라우팅·rate limit 같은 횡단 관심사, BFF는 클라이언트 특화 로직."

### 나쁜 예시 (낮은 세분도)
- "BFF는 백엔드 패턴이다." (맥락/의도/예시 없음)
- "MCP 서버 구조: index.ts → server.ts → tools" (왜 이 구조인지, 어떻게 활용하는지 없음)

### 형식 권장
- **[맥락: ...] + 본문** 형식으로 대화 맥락 명시
- **Q&A 형식**: "X란? [정의]. [목적/이유]. [사용 시점]. [예시]. [주의점]."
- **단계별 형식**: "X하는 방법: 1) ... 2) ... 3) ... 예시: ..."
- 구체적인 기술명, 도구명, 코드 스니펫 포함`,
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
