import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleSavewise } from "../../src/tools/savewise.js";

vi.mock("../../src/services/readwise.js", () => ({
  createHighlights: vi.fn(),
  ReadwiseError: class ReadwiseError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public response?: string
    ) {
      super(message);
      this.name = "ReadwiseError";
    }
  },
}));

import { createHighlights, ReadwiseError } from "../../src/services/readwise.js";

const mockCreateHighlights = vi.mocked(createHighlights);

describe("savewise tool", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, READWISE_TOKEN: "test-token" };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("handleSavewise", () => {
    it("should return error when READWISE_TOKEN is not set", async () => {
      // Arrange
      delete process.env.READWISE_TOKEN;
      const args = {
        highlights: [{ text: "Test", title: "Test" }],
      };

      // Act
      const result = await handleSavewise(args);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("READWISE_TOKEN");
    });

    it("should return error on invalid input", async () => {
      // Arrange
      const args = {
        highlights: [], // empty array - should fail validation
      };

      // Act
      const result = await handleSavewise(args);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Validation error");
    });

    it("should return error when highlights is missing", async () => {
      // Arrange
      const args = {};

      // Act
      const result = await handleSavewise(args);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Validation error");
    });

    it("should save highlights successfully", async () => {
      // Arrange
      const args = {
        highlights: [
          { text: "Test highlight", title: "Test Title" },
          { text: "Another highlight", title: "Test Title" },
        ],
      };
      mockCreateHighlights.mockResolvedValue([
        {
          id: 1,
          title: "Test Title",
          author: null,
          category: "articles",
          num_highlights: 2,
          source_url: null,
          highlights: [
            { id: 1, text: "Test highlight" },
            { id: 2, text: "Another highlight" },
          ],
        },
      ]);

      // Act
      const result = await handleSavewise(args);

      // Assert
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Successfully saved 2 highlight(s)");
      expect(mockCreateHighlights).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: "Test highlight", title: "Test Title" }),
          expect.objectContaining({ text: "Another highlight", title: "Test Title" }),
        ]),
        "test-token"
      );
    });

    it("should handle Readwise API errors", async () => {
      // Arrange
      const args = {
        highlights: [{ text: "Test", title: "Test" }],
      };
      mockCreateHighlights.mockRejectedValue(
        new (ReadwiseError as any)("Rate limit", 429)
      );

      // Act
      const result = await handleSavewise(args);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("429");
    });

    it("should handle unknown errors", async () => {
      // Arrange
      const args = {
        highlights: [{ text: "Test", title: "Test" }],
      };
      mockCreateHighlights.mockRejectedValue(new Error("Network error"));

      // Act
      const result = await handleSavewise(args);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Network error");
    });

    it("should pass all optional fields to createHighlights", async () => {
      // Arrange
      const args = {
        highlights: [
          {
            text: "Test highlight",
            title: "Test Title",
            author: "Author",
            source_url: "https://example.com",
            source_type: "article",
            category: "articles",
            note: "My note",
            location: 1,
            location_type: "order",
            highlighted_at: "2024-01-10T00:00:00Z",
            tags: ["tag1", "tag2"],
          },
        ],
      };
      mockCreateHighlights.mockResolvedValue([
        {
          id: 1,
          title: "Test Title",
          author: "Author",
          category: "articles",
          num_highlights: 1,
          source_url: "https://example.com",
          highlights: [{ id: 1, text: "Test highlight" }],
        },
      ]);

      // Act
      await handleSavewise(args);

      // Assert
      expect(mockCreateHighlights).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            text: "Test highlight",
            title: "Test Title",
            author: "Author",
            source_url: "https://example.com",
            tags: ["tag1", "tag2"],
          }),
        ]),
        "test-token"
      );
    });
  });
});
