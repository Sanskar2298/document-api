import { GraphQLError } from "graphql";
import { Prisma, type Collection, type Document } from "@prisma/client";
import type { GraphQLContext } from "./context";

interface CollectionArgs {
  id: string;
}

interface DocumentsArgs {
  collectionId?: string;
  search?: string;
  isArchived?: boolean;
  take?: number;
  cursor?: string;
}

interface PageInfo {
  nextCursor: string | null;
  hasNextPage: boolean;
}

interface DocumentConnection {
  items: Document[];
  pageInfo: PageInfo;
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

interface MoveDocumentArgs {
  id: string;
  collectionId: string;
}

/**
 * Slug regex:
 * - Allows lowercase alphanumeric characters and single hyphens.
 * - Disallows leading, trailing, or consecutive hyphens.
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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
    collections: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ): Promise<Collection[]> => {
      return context.prisma.collection.findMany();
    },

    /**
     * Fetches a single collection by ID, or returns null if not found.
     */
    collection: async (
      _parent: unknown,
      args: CollectionArgs,
      context: GraphQLContext,
    ): Promise<Collection | null> => {
      return context.prisma.collection.findUnique({
        where: { id: args.id },
      });
    },

    /**
     * Fetches documents with collection filtering, isArchived filtering,
     * substring search, and deterministic cursor-based pagination.
     */
    documents: async (
      _parent: unknown,
      args: DocumentsArgs,
      context: GraphQLContext,
    ): Promise<DocumentConnection> => {
      // 1. Validate take argument
      const take = args.take ?? DEFAULT_PAGE_SIZE;

      if (take <= 0) {
        throw new GraphQLError("take must be a positive integer greater than 0");
      }

      if (take > MAX_PAGE_SIZE) {
        throw new GraphQLError(`take cannot exceed maximum of ${MAX_PAGE_SIZE}`);
      }

      // 2. Build PostgreSQL where filters
      const where: Prisma.DocumentWhereInput = {};

      if (
        args.collectionId !== undefined &&
        args.collectionId !== null &&
        args.collectionId.trim().length > 0
      ) {
        where.collectionId = args.collectionId.trim();
      }

      if (args.isArchived !== undefined && args.isArchived !== null) {
        where.isArchived = args.isArchived;
      }

      if (
        args.search !== undefined &&
        args.search !== null &&
        args.search.trim().length > 0
      ) {
        const searchTerm = args.search.trim();
        where.OR = [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { content: { contains: searchTerm, mode: "insensitive" } },
        ];
      }

      // 3. Build query parameters with take + 1 for hasNextPage detection
      const findManyArgs: Prisma.DocumentFindManyArgs = {
        where,
        take: take + 1,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      };

      // 4. Validate and attach cursor
      if (
        args.cursor !== undefined &&
        args.cursor !== null &&
        args.cursor.trim().length > 0
      ) {
        const cursorId = args.cursor.trim();
        const cursorDocument = await context.prisma.document.findUnique({
          where: { id: cursorId },
        });

        if (!cursorDocument) {
          throw new GraphQLError("Invalid cursor");
        }

        findManyArgs.cursor = { id: cursorId };
        findManyArgs.skip = 1;
      }

      // 5. Execute query
      let records: Document[];
      try {
        records = await context.prisma.document.findMany(findManyArgs);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new GraphQLError("Invalid cursor");
        }
        throw error instanceof GraphQLError
          ? error
          : new GraphQLError("Failed to fetch documents");
      }

      // 6. Evaluate pagination metadata
      const hasNextPage = records.length > take;
      const items = hasNextPage ? records.slice(0, take) : records;
      const nextCursor =
        hasNextPage && items.length > 0
          ? items[items.length - 1]!.id
          : null;

      return {
        items,
        pageInfo: {
          nextCursor,
          hasNextPage,
        },
      };
    },
  },

  Mutation: {
    /**
     * Creates a new collection after validating name, slug format, and uniqueness.
     */
    createCollection: async (
      _parent: unknown,
      args: { input: CreateCollectionInput },
      context: GraphQLContext,
    ): Promise<Collection> => {
      validateCollectionInput(args.input);

      try {
        return await context.prisma.collection.create({
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
      context: GraphQLContext,
    ): Promise<Document> => {
      validateCreateDocumentInput(args.input);

      const collection = await context.prisma.collection.findUnique({
        where: { id: args.input.collectionId },
      });

      if (!collection) {
        throw new GraphQLError("Collection not found");
      }

      try {
        return await context.prisma.document.create({
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
      context: GraphQLContext,
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
        return await context.prisma.document.update({
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
      context: GraphQLContext,
    ): Promise<boolean> => {
      try {
        await context.prisma.document.delete({
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

    /**
     * Moves a document to a different collection.
     */
    moveDocument: async (
      _parent: unknown,
      args: MoveDocumentArgs,
      context: GraphQLContext,
    ): Promise<Document> => {
      // 1. Verify document exists
      const document = await context.prisma.document.findUnique({
        where: { id: args.id },
      });

      if (!document) {
        throw new GraphQLError("Document not found");
      }

      // 2. Verify target collection exists
      const targetCollection = await context.prisma.collection.findUnique({
        where: { id: args.collectionId },
      });

      if (!targetCollection) {
        throw new GraphQLError("Target collection not found");
      }

      // 3. If already in the target collection, treat as an idempotent no-op
      if (document.collectionId === args.collectionId) {
        return document;
      }

      // 4. Update the collection reference
      try {
        return await context.prisma.document.update({
          where: { id: args.id },
          data: {
            collectionId: args.collectionId,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new GraphQLError("Document not found");
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw new GraphQLError("Target collection not found");
        }
        throw error instanceof GraphQLError
          ? error
          : new GraphQLError("Failed to move document");
      }
    },
  },

  Collection: {
    /**
     * Resolves nested documents belonging to the parent collection.
     */
    documents: async (
      parent: Collection,
      _args: unknown,
      context: GraphQLContext,
    ): Promise<Document[]> => {
      return context.prisma.document.findMany({
        where: { collectionId: parent.id },
      });
    },
  },
};

export default resolvers;
