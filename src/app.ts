import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import resolvers from "./resolvers";
import type { GraphQLContext } from "./context";
import type { PrismaClient } from "@prisma/client";

// --- Load SDL schema from .graphql file (schema-first approach) ---
const typeDefs = readFileSync(
  join(import.meta.dir, "schema.graphql"),
  "utf-8",
);

// --- Create executable GraphQL schema ---
export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers,
});

/**
 * Creates a GraphQL Yoga application instance with the supplied Prisma client.
 * Reused between production server (src/index.ts) and integration tests.
 */
export function createApp(prismaClient: PrismaClient) {
  return createYoga<GraphQLContext>({
    schema,
    context: (): GraphQLContext => ({
      prisma: prismaClient,
    }),
  });
}
