import type {
  Highlight,
  ReadwiseHighlight,
  ReadwiseCreateResponse,
} from "../types/highlight.js";

const READWISE_API_URL = "https://readwise.io/api/v2/highlights/";

export class ReadwiseError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: string
  ) {
    super(message);
    this.name = "ReadwiseError";
  }
}

function toReadwiseHighlight(highlight: Highlight): ReadwiseHighlight {
  const result: ReadwiseHighlight = {
    text: highlight.text,
    title: highlight.title,
  };

  if (highlight.author) result.author = highlight.author;
  if (highlight.source_url) result.source_url = highlight.source_url;
  if (highlight.source_type) result.source_type = highlight.source_type;
  if (highlight.category) result.category = highlight.category;
  if (highlight.note) result.note = highlight.note;
  if (highlight.location !== undefined) result.location = highlight.location;
  if (highlight.location_type) result.location_type = highlight.location_type;
  if (highlight.highlighted_at)
    result.highlighted_at = highlight.highlighted_at;
  if (highlight.tags && highlight.tags.length > 0) {
    result.highlight_tags = highlight.tags.map((tag) => ({ name: tag }));
  }

  return result;
}

export async function createHighlights(
  highlights: Highlight[],
  token: string
): Promise<ReadwiseCreateResponse[]> {
  const readwiseHighlights = highlights.map(toReadwiseHighlight);

  const response = await fetch(READWISE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ highlights: readwiseHighlights }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401) {
      throw new ReadwiseError(
        "Invalid Readwise API token",
        401,
        errorText
      );
    }

    if (response.status === 429) {
      throw new ReadwiseError(
        "Readwise API rate limit exceeded",
        429,
        errorText
      );
    }

    throw new ReadwiseError(
      `Readwise API error: ${response.status}`,
      response.status,
      errorText
    );
  }

  return response.json() as Promise<ReadwiseCreateResponse[]>;
}
