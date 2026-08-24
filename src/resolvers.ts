import { GraphQLError } from "graphql";
import { Prisma, type Collection, type Document } from "@prisma/client";
import { prisma } from "./db";

interface CollectionArgs {
  id: string;
}

interface CreateCollectionInput {
  name: string;
  slug: string;
}

interface CreateDocumentInput {
  title: string;
  content: string;
  tags?: string[];
  collectionId: string;
}

interface UpdateDocumentInput {
  title?: string;
  content?: string;
  tags?: string[];
  isArchived?: boolean;
}

/**
 * Slug regex:
 * - Allows lowercase alphanumeric characters and single hyphens.
 * - Disallows leading, trailing, or consecutive hyphens.
 * - Example valid: "engineering-docs", "v2-spec-2026", "api"
 * - Example invalid: "Engineering Docs", "-slug", "slug-", "slug--slug", "slug!"
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateCollectionInput(input: CreateCollectionInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new GraphQLError("Collection name cannot be empty");
  }

  if (!input.slug || input.slug.trim().length === 0) {
    throw new GraphQLError("Invalid slug: slug cannot be empty");
  }

  if (!SLUG_REGEX.test(input.slug)) {
    throw new GraphQLError(
      "Invalid slug: must contain only lowercase letters, numbers, and hyphens without consecutive, leading, or trailing hyphens",
    );
  }
}

function validateCreateDocumentInput(input: CreateDocumentInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new GraphQLError("Document title cannot be empty");
  }

  if (!input.content || input.content.trim().length === 0) {
    throw new GraphQLError("Document content cannot be empty");
  }

  if (!input.collectionId || input.collectionId.trim().length === 0) {
    throw new GraphQLError("Collection ID cannot be empty");
  }
}

const resolvers = {
  Query: {
    /**
     * Fetches all collections from the database.
     */
    collections: async (): Promise<Collection[]> => {
      return prisma.collection.findMany();
    },

    /**
     * Fetches a single collection by ID, or returns null if not found.
     */
    collection: async (
      _parent: unknown,
      args: CollectionArgs,
    ): Promise<Collection | null> => {
      return prisma.collection.findUnique({
        where: { id: args.id },
      });
    },
  },

  Mutation: {
    /**
     * Creates a new collection after validating name, slug format, and uniqueness.
     */
    createCollection: async (
      _parent: unknown,
      args: { input: CreateCollectionInput },
    ): Promise<Collection> => {
      validateCollectionInput(args.input);

      try {
        return await prisma.collection.create({
          data: {
            name: args.input.name.trim(),
            slug: args.input.slug.trim(),
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new GraphQLError("Collection with this slug already exists");
        }
        throw error instanceof GraphQLError
          ? error
          : new GraphQLError("Failed to create collection");
      }
    },

    /**
     * Creates a new document after validating title, content, and collection existence.
     */
    createDocument: async (
      _parent: unknown,
      args: { input: CreateDocumentInput },
    ): Promise<Document> => {
      validateCreateDocumentInput(args.input);

      // Verify the parent collection exists
      const collection = await prisma.collection.findUnique({
        where: { id: args.input.collectionId },
      });

      if (!collection) {
        throw new GraphQLError("Collection not found");
      }

      try {
        return await prisma.document.create({
          data: {
            title: args.input.title.trim(),
            content: args.input.content.trim(),
            tags: args.input.tags ?? [],
            collectionId: args.input.collectionId,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw new GraphQLError("Collection not found");
        }
        throw error instanceof GraphQLError
          ? error
          : new GraphQLError("Failed to create document");
      }
    },

    /**
     * Updates an existing document with partial updates.
     */
    updateDocument: async (
      _parent: unknown,
      args: { id: string; input: UpdateDocumentInput },
    ): Promise<Document> => {
      const dataToUpdate: Prisma.DocumentUpdateInput = {};

      if (args.input.title !== undefined) {
        if (args.input.title.trim().length === 0) {
          throw new GraphQLError("Document title cannot be empty");
        }
        dataToUpdate.title = args.input.title.trim();
      }

      if (args.input.content !== undefined) {
        if (args.input.content.trim().length === 0) {
          throw new GraphQLError("Document content cannot be empty");
        }
        dataToUpdate.content = args.input.content.trim();
      }

      if (args.input.tags !== undefined) {
        dataToUpdate.tags = args.input.tags;
      }

      if (args.input.isArchived !== undefined) {
        dataToUpdate.isArchived = args.input.isArchived;
      }

      try {
        return await prisma.document.update({
          where: { id: args.id },
          data: dataToUpdate,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new GraphQLError("Document not found");
        }
        throw error instanceof GraphQLError
          ? error
          : new GraphQLError("Failed to update document");
      }
    },

    /**
     * Deletes a document by ID. Returns true if successfully deleted.
     */
    deleteDocument: async (
      _parent: unknown,
      args: { id: string },
    ): Promise<boolean> => {
      try {
        await prisma.document.delete({
          where: { id: args.id },
        });
        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new GraphQLError("Document not found");
        }
        throw error instanceof GraphQLError
          ? error
          : new GraphQLError("Failed to delete document");
      }
    },
  },

  Collection: {
    /**
     * Resolves nested documents belonging to the parent collection.
     */
    documents: async (parent: Collection): Promise<Document[]> => {
      return prisma.document.findMany({
        where: { collectionId: parent.id },
      });
    },
  },
};

export default resolvers;
