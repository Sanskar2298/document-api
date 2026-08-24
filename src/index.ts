import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import resolvers from "./resolvers";

// --- Load SDL schema from .graphql file (schema-first approach) ---
const typeDefs = readFileSync(
  join(import.meta.dir, "schema.graphql"),
  "utf-8",
);

// --- Create executable GraphQL schema ---
const schema = createSchema({
  typeDefs,
  resolvers,
});

// --- Create GraphQL Yoga server instance ---
const yoga = createYoga({
  schema,
  // GraphiQL is enabled by default in development
});

// --- Start HTTP server using Bun's native server ---
const PORT = Number(process.env.PORT) || 4000;

const server = Bun.serve({
  fetch: yoga,
  port: PORT,
});

console.log(
  `🚀 Document Vault API is running at http://localhost:${server.port}/graphql`,
);
