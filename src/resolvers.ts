import type { Collection, Document } from "@prisma/client";
import { prisma } from "./db";

interface CollectionArgs {
  id: string;
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
