import type { PrismaClient } from "@prisma/client";

/**
 * The GraphQL execution context shared across all resolvers.
 */
export interface GraphQLContext {
  prisma: PrismaClient;
}
