import { describe, test, expect, beforeEach } from "bun:test";
import { GraphQLError } from "graphql";
import { Prisma, type Collection, type Document } from "@prisma/client";
import resolvers from "../src/resolvers";
import { createMockContext, type MockPrisma } from "./mocks/prisma.mock";
import type { GraphQLContext } from "../src/context";

describe("Mutation Resolvers", () => {
  let context: GraphQLContext;
  let mockPrisma: MockPrisma;

  const mockDate = new Date("2026-08-25T00:00:00.000Z");

  const mockCollection: Collection = {
    id: "col_1",
    name: "Engineering",
    slug: "engineering",
    createdAt: mockDate,
  };

  const mockTargetCollection: Collection = {
    id: "col_2",
    name: "Product",
    slug: "product",
    createdAt: mockDate,
  };

  const mockDocument: Document = {
    id: "doc_1",
    title: "Initial Title",
    content: "Initial Content",
    tags: ["v1"],
    collectionId: "col_1",
    isArchived: false,
    createdAt: mockDate,
  };

  beforeEach(() => {
    const mockSetup = createMockContext();
    context = mockSetup.context;
    mockPrisma = mockSetup.mockPrisma;
  });

  // ==========================================
  // CREATE COLLECTION
  // ==========================================
  describe("createCollection", () => {
    test("successfully creates a collection with valid inputs", async () => {
      mockPrisma.collection.create.mockResolvedValue(mockCollection);

      const result = await resolvers.Mutation.createCollection(
        {},
        { input: { name: "  Engineering  ", slug: "engineering" } },
        context,
      );

      expect(mockPrisma.collection.create).toHaveBeenCalledWith({
        data: {
          name: "Engineering",
          slug: "engineering",
        },
      });
      expect(result).toEqual(mockCollection);
    });

    test("rejects empty collection name", async () => {
      expect(
        resolvers.Mutation.createCollection(
          {},
          { input: { name: "", slug: "valid-slug" } },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Collection name cannot be empty"));
    });

    test("rejects whitespace-only collection name", async () => {
      expect(
        resolvers.Mutation.createCollection(
          {},
          { input: { name: "   ", slug: "valid-slug" } },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Collection name cannot be empty"));
    });

    test("rejects empty slug", async () => {
      expect(
        resolvers.Mutation.createCollection(
          {},
          { input: { name: "Valid Name", slug: "" } },
          context,
        ),
      ).rejects.toThrow("Invalid slug");
    });

    test("rejects malformed slug (spaces, uppercase, symbols, consecutive hyphens)", async () => {
      const invalidSlugs = [
        "Invalid Slug",
        "slug_with_underscore",
        "-leading-hyphen",
        "trailing-hyphen-",
        "consecutive--hyphens",
        "slug@symbol",
      ];

      for (const slug of invalidSlugs) {
        expect(
          resolvers.Mutation.createCollection(
            {},
            { input: { name: "Valid Name", slug } },
            context,
          ),
        ).rejects.toThrow("Invalid slug");
      }
    });

    test("maps Prisma P2002 duplicate slug error to GraphQLError", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "6.0.0" },
      );
      mockPrisma.collection.create.mockRejectedValue(p2002Error);

      expect(
        resolvers.Mutation.createCollection(
          {},
          { input: { name: "Engineering", slug: "engineering" } },
          context,
        ),
      ).rejects.toThrow(
        new GraphQLError("Collection with this slug already exists"),
      );
    });
  });

  // ==========================================
  // CREATE DOCUMENT
  // ==========================================
  describe("createDocument", () => {
    test("successfully creates a document with valid inputs", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(mockCollection);
      mockPrisma.document.create.mockResolvedValue(mockDocument);

      const result = await resolvers.Mutation.createDocument(
        {},
        {
          input: {
            title: "  New Doc  ",
            content: "  Body text  ",
            tags: ["design", "arch"],
            collectionId: "col_1",
          },
        },
        context,
      );

      expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith({
        where: { id: "col_1" },
      });
      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: {
          title: "New Doc",
          content: "Body text",
          tags: ["design", "arch"],
          collectionId: "col_1",
        },
      });
      expect(result).toEqual(mockDocument);
    });

    test("defaults tags to empty array when omitted", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(mockCollection);
      mockPrisma.document.create.mockResolvedValue(mockDocument);

      await resolvers.Mutation.createDocument(
        {},
        {
          input: {
            title: "Doc without tags",
            content: "Content",
            collectionId: "col_1",
          },
        },
        context,
      );

      expect(mockPrisma.document.create).toHaveBeenCalledWith({
        data: {
          title: "Doc without tags",
          content: "Content",
          tags: [],
          collectionId: "col_1",
        },
      });
    });

    test("rejects empty title", async () => {
      expect(
        resolvers.Mutation.createDocument(
          {},
          {
            input: {
              title: "",
              content: "Content",
              collectionId: "col_1",
            },
          },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document title cannot be empty"));
    });

    test("rejects whitespace title", async () => {
      expect(
        resolvers.Mutation.createDocument(
          {},
          {
            input: {
              title: "    ",
              content: "Content",
              collectionId: "col_1",
            },
          },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document title cannot be empty"));
    });

    test("rejects empty content", async () => {
      expect(
        resolvers.Mutation.createDocument(
          {},
          {
            input: {
              title: "Title",
              content: "",
              collectionId: "col_1",
            },
          },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document content cannot be empty"));
    });

    test("rejects whitespace content", async () => {
      expect(
        resolvers.Mutation.createDocument(
          {},
          {
            input: {
              title: "Title",
              content: "    ",
              collectionId: "col_1",
            },
          },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document content cannot be empty"));
    });

    test("rejects when parent collection does not exist", async () => {
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      expect(
        resolvers.Mutation.createDocument(
          {},
          {
            input: {
              title: "Title",
              content: "Content",
              collectionId: "missing_col",
            },
          },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Collection not found"));
    });
  });

  // ==========================================
  // UPDATE DOCUMENT
  // ==========================================
  describe("updateDocument", () => {
    test("successfully updates single field (title) and preserves others", async () => {
      const updatedDoc = { ...mockDocument, title: "Updated Title" };
      mockPrisma.document.update.mockResolvedValue(updatedDoc);

      const result = await resolvers.Mutation.updateDocument(
        {},
        { id: "doc_1", input: { title: "Updated Title" } },
        context,
      );

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc_1" },
        data: { title: "Updated Title" },
      });
      expect(result).toEqual(updatedDoc);
    });

    test("successfully updates tags to empty array", async () => {
      const updatedDoc = { ...mockDocument, tags: [] };
      mockPrisma.document.update.mockResolvedValue(updatedDoc);

      await resolvers.Mutation.updateDocument(
        {},
        { id: "doc_1", input: { tags: [] } },
        context,
      );

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc_1" },
        data: { tags: [] },
      });
    });

    test("successfully toggles isArchived to true", async () => {
      const updatedDoc = { ...mockDocument, isArchived: true };
      mockPrisma.document.update.mockResolvedValue(updatedDoc);

      await resolvers.Mutation.updateDocument(
        {},
        { id: "doc_1", input: { isArchived: true } },
        context,
      );

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc_1" },
        data: { isArchived: true },
      });
    });

    test("rejects explicit empty title on update", async () => {
      expect(
        resolvers.Mutation.updateDocument(
          {},
          { id: "doc_1", input: { title: "   " } },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document title cannot be empty"));
    });

    test("rejects explicit empty content on update", async () => {
      expect(
        resolvers.Mutation.updateDocument(
          {},
          { id: "doc_1", input: { content: "   " } },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document content cannot be empty"));
    });

    test("throws Document not found when document does not exist (P2025)", async () => {
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        "Record to update not found",
        { code: "P2025", clientVersion: "6.0.0" },
      );
      mockPrisma.document.update.mockRejectedValue(p2025Error);

      expect(
        resolvers.Mutation.updateDocument(
          {},
          { id: "missing_doc", input: { title: "New Title" } },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document not found"));
    });
  });

  // ==========================================
  // DELETE DOCUMENT
  // ==========================================
  describe("deleteDocument", () => {
    test("successfully deletes existing document and returns true", async () => {
      mockPrisma.document.delete.mockResolvedValue(mockDocument);

      const result = await resolvers.Mutation.deleteDocument(
        {},
        { id: "doc_1" },
        context,
      );

      expect(mockPrisma.document.delete).toHaveBeenCalledWith({
        where: { id: "doc_1" },
      });
      expect(result).toBe(true);
    });

    test("throws Document not found when document does not exist (P2025)", async () => {
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        "Record to delete not found",
        { code: "P2025", clientVersion: "6.0.0" },
      );
      mockPrisma.document.delete.mockRejectedValue(p2025Error);

      expect(
        resolvers.Mutation.deleteDocument(
          {},
          { id: "missing_doc" },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document not found"));
    });
  });

  // ==========================================
  // MOVE DOCUMENT
  // ==========================================
  describe("moveDocument", () => {
    test("successfully moves document to target collection", async () => {
      const movedDoc = { ...mockDocument, collectionId: "col_2" };
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      mockPrisma.collection.findUnique.mockResolvedValue(mockTargetCollection);
      mockPrisma.document.update.mockResolvedValue(movedDoc);

      const result = await resolvers.Mutation.moveDocument(
        {},
        { id: "doc_1", collectionId: "col_2" },
        context,
      );

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc_1" },
        data: { collectionId: "col_2" },
      });
      expect(result).toEqual(movedDoc);
    });

    test("returns document immediately as idempotent no-op when moving to current collection", async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      mockPrisma.collection.findUnique.mockResolvedValue(mockCollection);

      const result = await resolvers.Mutation.moveDocument(
        {},
        { id: "doc_1", collectionId: "col_1" },
        context,
      );

      expect(mockPrisma.document.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockDocument);
    });

    test("throws Document not found when document does not exist", async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      expect(
        resolvers.Mutation.moveDocument(
          {},
          { id: "missing_doc", collectionId: "col_2" },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Document not found"));
    });

    test("throws Target collection not found when target collection does not exist", async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
      mockPrisma.collection.findUnique.mockResolvedValue(null);

      expect(
        resolvers.Mutation.moveDocument(
          {},
          { id: "doc_1", collectionId: "missing_col" },
          context,
        ),
      ).rejects.toThrow(new GraphQLError("Target collection not found"));
    });
  });
});
