import { z } from "zod";

export const HighlightSchema = z.object({
  text: z
    .string()
    .describe(
      "하이라이트 본문. 하나의 개념/주제를 완결된 형태로 담아야 함. 권장 형식: 'X란? [정의]. [목적/이유]. [사용 시점]. [주의점].' 또는 'X하는 방법: 1)... 2)... 3)...'. 구체적인 기술명, 예시, 맥락 포함 권장."
    ),
  title: z
    .string()
    .describe(
      "출처 제목. Claude 대화의 경우 'Claude 대화 - YYYY-MM-DD' 또는 주제명 사용"
    ),
  author: z.string().optional().describe("저자 (Claude 대화의 경우 생략 가능)"),
  source_url: z.string().optional().describe("출처 URL"),
  source_type: z.string().optional().describe("출처 타입 (article, book 등)"),
  category: z
    .string()
    .optional()
    .default("articles")
    .describe("카테고리 (books, articles, tweets 등)"),
  note: z
    .string()
    .optional()
    .describe(
      "추가 메모. 하이라이트의 맥락, 적용 계획, 관련 프로젝트 등을 기록"
    ),
  location: z.number().optional().describe("위치"),
  location_type: z
    .string()
    .optional()
    .describe("위치 타입 (page, order 등)"),
  highlighted_at: z.string().optional().describe("ISO 8601 타임스탬프"),
  tags: z.array(z.string()).optional().describe("태그 배열"),
});

export const SavewiseInputSchema = z.object({
  highlights: z
    .array(HighlightSchema)
    .min(1)
    .describe("저장할 하이라이트 배열"),
});

export type Highlight = z.infer<typeof HighlightSchema>;
export type SavewiseInput = z.infer<typeof SavewiseInputSchema>;

export interface ReadwiseHighlight {
  text: string;
  title: string;
  author?: string;
  source_url?: string;
  source_type?: string;
  category?: string;
  note?: string;
  location?: number;
  location_type?: string;
  highlighted_at?: string;
  highlight_tags?: { name: string }[];
}

export interface ReadwiseCreateResponse {
  id: number;
  title: string;
  author: string | null;
  category: string;
  num_highlights: number;
  source_url: string | null;
  highlights: { id: number; text: string }[];
}
