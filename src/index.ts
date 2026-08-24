import { createApp } from "./app";
import { prisma } from "./db";

// --- Create GraphQL Yoga server instance with production Prisma client ---
const app = createApp(prisma);

// --- Start HTTP server using Bun's native server ---
const PORT = Number(process.env.PORT) || 4000;

const server = Bun.serve({
  fetch: (request: Request) => app.fetch(request),
  port: PORT,
});

console.log(
  `🚀 Document Vault API is running at http://localhost:${server.port}/graphql`,
);
