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

function validateDocumentInput(input: CreateDocumentInput): void {
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
      validateDocumentInput(args.input);

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
