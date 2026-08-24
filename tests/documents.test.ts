import { describe, test, expect, beforeEach } from "bun:test";
import { GraphQLError } from "graphql";
import resolvers from "../src/resolvers";
import { createMockContext, type MockPrisma } from "./mocks/prisma.mock";
import type { GraphQLContext } from "../src/context";
import type { Document } from "@prisma/client";

describe("Document Query Resolvers (Filters, Search & Cursor Pagination)", () => {
  let context: GraphQLContext;
  let mockPrisma: MockPrisma;

  const mockDate = new Date("2026-08-25T00:00:00.000Z");

  const createDoc = (id: string, title: string, isArchived = false): Document => ({
    id,
    title,
    content: `Content for ${title}`,
    tags: ["test"],
    collectionId: "col_1",
    isArchived,
    createdAt: mockDate,
  });

  beforeEach(() => {
    const mockSetup = createMockContext();
    context = mockSetup.context;
    mockPrisma = mockSetup.mockPrisma;
  });

  // ==========================================
  // FILTERS & SEARCH
  // ==========================================
  describe("Filtering and Search", () => {
    test("applies collectionId filter to Prisma where clause", async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(
        {},
        { collectionId: "col_1" },
        context,
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            collectionId: "col_1",
          }),
        }),
      );
    });

    test("explicitly passes isArchived: true in Prisma where clause", async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(
        {},
        { isArchived: true },
        context,
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: true,
          }),
        }),
      );
    });

    test("explicitly passes isArchived: false in Prisma where clause (does not treat false as falsy omitted)", async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(
        {},
        { isArchived: false },
        context,
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: false,
          }),
        }),
      );
    });

    test("applies case-insensitive OR substring search across title and content", async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(
        {},
        { search: "React" },
        context,
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: "React", mode: "insensitive" } },
              { content: { contains: "React", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    test("combines collectionId, isArchived, and search in a single Prisma where object", async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents(
        {},
        {
          collectionId: "col_1",
          isArchived: false,
          search: "architecture",
        },
        context,
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            collectionId: "col_1",
            isArchived: false,
            OR: [
              { title: { contains: "architecture", mode: "insensitive" } },
              { content: { contains: "architecture", mode: "insensitive" } },
            ],
          },
        }),
      );
    });
  });

  // ==========================================
  // CURSOR PAGINATION
  // ==========================================
  describe("Cursor-based Pagination", () => {
    test("uses default take = 20 and queries Prisma with take = 21 (take + 1)", async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents({}, {}, context);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 21,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
      );
    });

    test("uses custom take and queries Prisma with take + 1", async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await resolvers.Query.documents({}, { take: 5 }, context);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 6,
        }),
      );
    });

    test("rejects invalid take <= 0 with GraphQLError", async () => {
      expect(
        resolvers.Query.documents({}, { take: 0 }, context),
      ).rejects.toThrow(
        new GraphQLError("take must be a positive integer greater than 0"),
      );

      expect(
        resolvers.Query.documents({}, { take: -5 }, context),
      ).rejects.toThrow(
        new GraphQLError("take must be a positive integer greater than 0"),
      );
    });

    test("rejects take exceeding maximum of 100 with GraphQLError", async () => {
      expect(
        resolvers.Query.documents({}, { take: 101 }, context),
      ).rejects.toThrow(new GraphQLError("take cannot exceed maximum of 100"));
    });

    test("calculates hasNextPage: true and nextCursor when more records exist", async () => {
      // For take = 2, Prisma returns 3 items (take + 1)
      const doc1 = createDoc("doc_1", "Doc 1");
      const doc2 = createDoc("doc_2", "Doc 2");
      const doc3 = createDoc("doc_3", "Doc 3");

      mockPrisma.document.findMany.mockResolvedValue([doc1, doc2, doc3]);

      const result = await resolvers.Query.documents(
        {},
        { take: 2 },
        context,
      );

      // Should return only 2 items and set nextCursor to doc2's ID
      expect(result.items).toEqual([doc1, doc2]);
      expect(result.pageInfo).toEqual({
        nextCursor: "doc_2",
        hasNextPage: true,
      });
    });

    test("calculates hasNextPage: false and nextCursor: null on the final page", async () => {
      // For take = 2, Prisma returns only 2 items (no extra record)
      const doc1 = createDoc("doc_1", "Doc 1");
      const doc2 = createDoc("doc_2", "Doc 2");

      mockPrisma.document.findMany.mockResolvedValue([doc1, doc2]);

      const result = await resolvers.Query.documents(
        {},
        { take: 2 },
        context,
      );

      expect(result.items).toEqual([doc1, doc2]);
      expect(result.pageInfo).toEqual({
        nextCursor: null,
        hasNextPage: false,
      });
    });

    test("passes cursor and skip: 1 to Prisma when cursor is provided", async () => {
      const cursorDoc = createDoc("doc_2", "Doc 2");
      const doc3 = createDoc("doc_3", "Doc 3");

      mockPrisma.document.findUnique.mockResolvedValue(cursorDoc);
      mockPrisma.document.findMany.mockResolvedValue([doc3]);

      const result = await resolvers.Query.documents(
        {},
        { take: 2, cursor: "doc_2" },
        context,
      );

      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: "doc_2" },
      });
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "doc_2" },
          skip: 1,
          take: 3,
        }),
      );
      expect(result.items).toEqual([doc3]);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    test("throws Invalid cursor when cursor does not correspond to an existing document", async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      expect(
        resolvers.Query.documents(
          {},
          { take: 2, cursor: "non_existent_cursor" },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Invalid cursor"));
    });
  });
});
