# Document Vault — GraphQL API

A production-minded Document Vault backend API built with Bun, TypeScript, GraphQL Yoga, PostgreSQL, and Prisma.

The API allows users to organize documents into collections, search and filter documents, move documents between collections, and paginate documents using cursor-based pagination.

## Tech Stack

- Bun
- TypeScript
- GraphQL Yoga
- GraphQL SDL (schema-first)
- PostgreSQL
- Prisma ORM
- Docker Compose
- Bun Test

## Features

- Create and manage collections
- Create, update, and delete documents
- Move documents between collections
- Search documents by substring match on title or content
- Filter documents by collection
- Filter documents by archived state
- Fetch a collection with its nested documents
- Cursor-based pagination for documents
- Input validation with GraphQL errors
- Prisma migrations
- Resolver unit tests
- PostgreSQL integration testing

## Project Structure

```text
.
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── db.ts
│   ├── index.ts
│   ├── resolvers.ts
│   └── schema.graphql
├── tests/
│   ├── collections.test.ts
│   ├── documents.test.ts
│   ├── mutations.test.ts
│   └── integration.test.ts
├── .gitignore
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md

## Verification

The project has been verified locally with:

- 42 unit tests
- 1 end-to-end integration test
- 43 total tests passing
- 0 test failures
- TypeScript strict typecheck
- Prisma migration status check