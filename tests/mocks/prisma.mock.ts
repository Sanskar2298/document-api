import { mock } from "bun:test";
import type { PrismaClient } from "@prisma/client";
import type { GraphQLContext } from "../../src/context";

export interface MockPrisma {
  collection: {
    findMany: ReturnType<typeof mock>;
    findUnique: ReturnType<typeof mock>;
    create: ReturnType<typeof mock>;
    update: ReturnType<typeof mock>;
    delete: ReturnType<typeof mock>;
  };
  document: {
    findMany: ReturnType<typeof mock>;
    findUnique: ReturnType<typeof mock>;
    create: ReturnType<typeof mock>;
    update: ReturnType<typeof mock>;
    delete: ReturnType<typeof mock>;
  };
}

/**
 * Creates a fully isolated, strictly-typed mock context for unit testing resolvers.
 * Zero database connections required.
 */
export function createMockContext(): {
  context: GraphQLContext;
  mockPrisma: MockPrisma;
} {
  const mockPrisma: MockPrisma = {
    collection: {
      findMany: mock(),
      findUnique: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
    },
    document: {
      findMany: mock(),
      findUnique: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
    },
  };

  const context: GraphQLContext = {
    prisma: mockPrisma as unknown as PrismaClient,
  };

  return { context, mockPrisma };
}
