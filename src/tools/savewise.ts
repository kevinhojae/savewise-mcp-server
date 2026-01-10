import { createHighlights, ReadwiseError } from "../services/readwise.js";
import { SavewiseInputSchema } from "../types/highlight.js";

export async function handleSavewise(
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const token = process.env.READWISE_TOKEN;

  if (!token) {
    return {
      content: [
        {
          type: "text",
          text: "Error: READWISE_TOKEN environment variable is not set",
        },
      ],
      isError: true,
    };
  }

  const parseResult = SavewiseInputSchema.safeParse(args);

  if (!parseResult.success) {
    return {
      content: [
        {
          type: "text",
          text: `Validation error: ${parseResult.error.message}`,
        },
      ],
      isError: true,
    };
  }

  const { highlights } = parseResult.data;

  try {
    const result = await createHighlights(highlights, token);
    const savedCount = result.reduce((acc, r) => acc + r.num_highlights, 0);

    return {
      content: [
        {
          type: "text",
          text: `Successfully saved ${savedCount} highlight(s) to Readwise.`,
        },
      ],
    };
  } catch (error) {
    if (error instanceof ReadwiseError) {
      return {
        content: [
          {
            type: "text",
            text: `Readwise API error (${error.statusCode}): ${error.message}`,
          },
        ],
        isError: true,
      };
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: `Error saving to Readwise: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
