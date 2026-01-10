import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createHighlights,
  ReadwiseError,
} from "../../src/services/readwise.js";
import type { Highlight } from "../../src/types/highlight.js";

describe("readwise service", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetAllMocks();
  });

  describe("createHighlights", () => {
    it("should create highlights successfully", async () => {
      // Arrange
      const highlights: Highlight[] = [
        { text: "Test highlight", title: "Test Title", category: "articles" },
      ];
      const token = "test-token";
      const mockResponse = [
        {
          id: 1,
          title: "Test Title",
          author: null,
          category: "articles",
          num_highlights: 1,
          source_url: null,
          highlights: [{ id: 1, text: "Test highlight" }],
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // Act
      const result = await createHighlights(highlights, token);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://readwise.io/api/v2/highlights/",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Token test-token",
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should convert tags to highlight_tags format", async () => {
      // Arrange
      const highlights: Highlight[] = [
        {
          text: "Test highlight",
          title: "Test Title",
          tags: ["tag1", "tag2"],
          category: "articles",
        },
      ];
      const token = "test-token";
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      // Act
      await createHighlights(highlights, token);

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.highlights[0].highlight_tags).toEqual([
        { name: "tag1" },
        { name: "tag2" },
      ]);
    });

    it("should throw ReadwiseError on 401 unauthorized", async () => {
      // Arrange
      const highlights: Highlight[] = [
        { text: "Test", title: "Test", category: "articles" },
      ];
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      // Act & Assert
      await expect(createHighlights(highlights, "bad-token")).rejects.toThrow(
        ReadwiseError
      );
      await expect(
        createHighlights(highlights, "bad-token")
      ).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid Readwise API token",
      });
    });

    it("should throw ReadwiseError on 429 rate limit", async () => {
      // Arrange
      const highlights: Highlight[] = [
        { text: "Test", title: "Test", category: "articles" },
      ];
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limited"),
      });

      // Act & Assert
      await expect(createHighlights(highlights, "token")).rejects.toThrow(
        ReadwiseError
      );
      await expect(createHighlights(highlights, "token")).rejects.toMatchObject(
        {
          statusCode: 429,
          message: "Readwise API rate limit exceeded",
        }
      );
    });

    it("should throw ReadwiseError on server error", async () => {
      // Arrange
      const highlights: Highlight[] = [
        { text: "Test", title: "Test", category: "articles" },
      ];
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal server error"),
      });

      // Act & Assert
      await expect(createHighlights(highlights, "token")).rejects.toThrow(
        ReadwiseError
      );
      await expect(createHighlights(highlights, "token")).rejects.toMatchObject(
        {
          statusCode: 500,
        }
      );
    });
  });
});
