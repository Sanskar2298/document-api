import { PrismaClient } from "@prisma/client";

/**
 * Singleton instance of PrismaClient.
 * Reused across all resolvers to share database connections.
 */
export const prisma = new PrismaClient();
