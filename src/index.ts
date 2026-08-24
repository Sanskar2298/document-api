import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import resolvers from "./resolvers";
import { prisma } from "./db";
import type { GraphQLContext } from "./context";

// --- Load SDL schema from .graphql file (schema-first approach) ---
const typeDefs = readFileSync(
  join(import.meta.dir, "schema.graphql"),
  "utf-8",
);

// --- Create executable GraphQL schema ---
const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers,
});

// --- Create GraphQL Yoga server instance with Context ---
const yoga = createYoga<GraphQLContext>({
  schema,
  context: (): GraphQLContext => ({
    prisma,
  }),
});

// --- Start HTTP server using Bun's native server ---
const PORT = Number(process.env.PORT) || 4000;

const server = Bun.serve({
  fetch: (request: Request) => yoga.fetch(request),
  port: PORT,
});

console.log(
  `🚀 Document Vault API is running at http://localhost:${server.port}/graphql`,
);
