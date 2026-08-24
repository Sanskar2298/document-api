import { describe, test, expect, beforeEach } from "bun:test";
import resolvers from "../src/resolvers";
import { createMockContext, type MockPrisma } from "./mocks/prisma.mock";
import type { GraphQLContext } from "../src/context";
import type { Collection, Document } from "@prisma/client";

describe("Collection Resolvers", () => {
  let context: GraphQLContext;
  let mockPrisma: MockPrisma;

  const mockDate = new Date("2026-08-25T00:00:00.000Z");

  const mockCollection: Collection = {
    id: "col_1",
    name: "Engineering",
    slug: "engineering",
    createdAt: mockDate,
  };

  const mockDocument: Document = {
    id: "doc_1",
    title: "RFC 101",
    content: "Design document",
    tags: ["rfc", "backend"],
    collectionId: "col_1",
    isArchived: false,
    createdAt: mockDate,
  };

  beforeEach(() => {
    const mockSetup = createMockContext();
    context = mockSetup.context;
    mockPrisma = mockSetup.mockPrisma;
  });

  describe("Query.collections", () => {
    test("returns all collections from Prisma", async () => {
      mockPrisma.collection.findMany.mockResolvedValue([mockCollection]);

      const result = await resolvers.Query.collections({}, {}, context);

      expect(mockPrisma.collection.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual([mockCollection]);
    });
  });

  describe("Query.collection", () => {
    test("returns a single collection when ID exists", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(mockCollection);

      const result = await resolvers.Query.collection(
        {},
        { id: "col_1" },
        context,
      );

      expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith({
        where: { id: "col_1" },
      });
      expect(result).toEqual(mockCollection);
    });

    test("returns null when collection is not found", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      const result = await resolvers.Query.collection(
        {},
        { id: "non_existent" },
        context,
      );

      expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith({
        where: { id: "non_existent" },
      });
      expect(result).toBeNull();
    });
  });

  describe("Collection.documents", () => {
    test("returns nested documents filtered by parent collection ID", async () => {
      mockPrisma.document.findMany.mockResolvedValue([mockDocument]);

      const result = await resolvers.Collection.documents(
        mockCollection,
        {},
        context,
      );

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: { collectionId: "col_1" },
      });
      expect(result).toEqual([mockDocument]);
    });
  });
});
