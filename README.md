# Document Vault — GraphQL API

A production-minded Document Vault backend built with **Bun, TypeScript, GraphQL Yoga, PostgreSQL, and Prisma**.

The API allows users to organize documents into collections, search and filter documents, move documents between collections, and paginate results using cursor-based pagination.

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **API:** GraphQL Yoga
- **Schema:** GraphQL schema-first (`.graphql`)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Testing:** Bun Test
- **Infrastructure:** Docker Compose

---

## Features

### Collections

- Create collections with a unique slug
- Fetch all collections
- Fetch a single collection by ID
- Fetch documents nested inside a collection
- Validate collection names and slugs
- Handle duplicate slugs with GraphQL errors

### Documents

- Create documents inside collections
- Update documents using partial updates
- Delete documents
- Move documents between collections
- Archive/unarchive documents
- Store tags as a list of strings

### Search & Filtering

Documents can be filtered by:

- Collection ID
- Archived state
- Substring search across title and content

Search is case-insensitive across document titles and content.

### Cursor-Based Pagination

The `documents` query supports:

- `take`
- `cursor`
- `hasNextPage`
- `nextCursor`

Pagination uses the `take + 1` approach to determine whether another page exists.

### Validation & Error Handling

The API rejects invalid input with proper GraphQL errors, including:

- Empty collection names
- Empty document titles
- Empty document content
- Invalid slugs
- Invalid pagination values
- Invalid cursors
- Missing collections
- Missing documents
- Duplicate collection slugs

Prisma errors such as `P2002` and `P2025` are mapped to meaningful GraphQL errors.

---

## Project Structure

```text
document-vault/
│
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── src/
│   ├── app.ts
│   ├── db.ts
│   ├── index.ts
│   ├── resolvers.ts
│   └── schema.graphql
│
├── tests/
│   ├── collections.test.ts
│   ├── documents.test.ts
│   ├── mutations.test.ts
│   └── integration.test.ts
│
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env
└── README.md

## Project Status

The implementation has been tested locally with both mocked Prisma unit tests and a real PostgreSQL integration test.

Current test status:

- 43 tests passing
- 0 tests failing
- TypeScript strict typecheck passing
- Prisma migrations up to date
