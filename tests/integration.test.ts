import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://docvault:docvault@localhost:5433/docvault_test?schema=public";

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: ReadonlyArray<{ message: string }>;
}

describe("End-to-End Integration Suite (GraphQL Yoga + Prisma + Docker PostgreSQL)", () => {
  let testPrisma: PrismaClient;
  let app: ReturnType<typeof createApp>;

  // Helper to dispatch real GraphQL requests via Yoga's Fetch API
  async function executeGraphQL<TData = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphQLResponse<TData>> {
    const response = await app.fetch("http://localhost/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    return (await response.json()) as GraphQLResponse<TData>;
  }

  beforeAll(async () => {
    // 1. Instantiate real PrismaClient dedicated to docvault_test
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL,
        },
      },
    });

    // 2. Instantiate real Yoga application bound to the test database
    app = createApp(testPrisma);

    // 3. Clean test database before test run
    await testPrisma.collection.deleteMany();
  });

  afterAll(async () => {
    // Clean test database and release connection pool
    if (testPrisma) {
      await testPrisma.collection.deleteMany();
      await testPrisma.$disconnect();
    }
  });

  test("Complete Document Vault Lifecycle: Create Collection -> Create Document -> Query Nested -> Search -> Update -> Delete", async () => {
    // ----------------------------------------------------
    // Step 1: Create a Collection via GraphQL Mutation
    // ----------------------------------------------------
    const createColMutation = `
      mutation CreateCollection($input: CreateCollectionInput!) {
        createCollection(input: $input) {
          id
          name
          slug
          createdAt
        }
      }
    `;

    interface CreateCollectionData {
      createCollection: {
        id: string;
        name: string;
        slug: string;
        createdAt: string;
      };
    }

    const colRes = await executeGraphQL<CreateCollectionData>(
      createColMutation,
      {
        input: {
          name: "Engineering Vault",
          slug: "integration-test-vault",
        },
      },
    );

    expect(colRes.errors).toBeUndefined();
    expect(colRes.data?.createCollection.id).toBeDefined();
    expect(colRes.data?.createCollection.name).toBe("Engineering Vault");
    expect(colRes.data?.createCollection.slug).toBe("integration-test-vault");

    const collectionId = colRes.data!.createCollection.id;

    // Verify row was physically persisted in PostgreSQL (docvault_test)
    const dbCollection = await testPrisma.collection.findUnique({
      where: { id: collectionId },
    });
    expect(dbCollection).not.toBeNull();
    expect(dbCollection?.slug).toBe("integration-test-vault");

    // ----------------------------------------------------
    // Step 2: Create a Document via GraphQL Mutation
    // ----------------------------------------------------
    const createDocMutation = `
      mutation CreateDocument($input: CreateDocumentInput!) {
        createDocument(input: $input) {
          id
          title
          content
          tags
          collectionId
          isArchived
          createdAt
        }
      }
    `;

    interface CreateDocumentData {
      createDocument: {
        id: string;
        title: string;
        content: string;
        tags: string[];
        collectionId: string;
        isArchived: boolean;
        createdAt: string;
      };
    }

    const docRes = await executeGraphQL<CreateDocumentData>(createDocMutation, {
      input: {
        title: "Architecture RFC",
        content: "High scale distributed systems design",
        tags: ["architecture", "rfc"],
        collectionId,
      },
    });

    expect(docRes.errors).toBeUndefined();
    expect(docRes.data?.createDocument.id).toBeDefined();
    expect(docRes.data?.createDocument.title).toBe("Architecture RFC");
    expect(docRes.data?.createDocument.tags).toEqual(["architecture", "rfc"]);
    expect(docRes.data?.createDocument.collectionId).toBe(collectionId);
    expect(docRes.data?.createDocument.isArchived).toBe(false);

    const documentId = docRes.data!.createDocument.id;

    // Verify row in PostgreSQL
    const dbDoc = await testPrisma.document.findUnique({
      where: { id: documentId },
    });
    expect(dbDoc).not.toBeNull();
    expect(dbDoc?.collectionId).toBe(collectionId);
    expect(dbDoc?.isArchived).toBe(false);

    // ----------------------------------------------------
    // Step 3: Query Collection with Nested Documents
    // ----------------------------------------------------
    const getCollectionQuery = `
      query GetCollection($id: ID!) {
        collection(id: $id) {
          id
          name
          slug
          documents {
            id
            title
            tags
            isArchived
          }
        }
      }
    `;

    interface GetCollectionData {
      collection: {
        id: string;
        name: string;
        slug: string;
        documents: Array<{
          id: string;
          title: string;
          tags: string[];
          isArchived: boolean;
        }>;
      } | null;
    }

    const queryColRes = await executeGraphQL<GetCollectionData>(
      getCollectionQuery,
      {
        id: collectionId,
      },
    );

    expect(queryColRes.errors).toBeUndefined();
    expect(queryColRes.data?.collection).not.toBeNull();
    expect(queryColRes.data?.collection?.id).toBe(collectionId);
    expect(queryColRes.data?.collection?.documents.length).toBe(1);
    expect(queryColRes.data?.collection?.documents[0]?.id).toBe(documentId);
    expect(queryColRes.data?.collection?.documents[0]?.title).toBe(
      "Architecture RFC",
    );

    // ----------------------------------------------------
    // Step 4: Search Documents in PostgreSQL
    // ----------------------------------------------------
    const searchDocsQuery = `
      query SearchDocs($search: String, $collectionId: ID) {
        documents(search: $search, collectionId: $collectionId) {
          items {
            id
            title
            content
          }
          pageInfo {
            nextCursor
            hasNextPage
          }
        }
      }
    `;

    interface SearchDocsData {
      documents: {
        items: Array<{
          id: string;
          title: string;
          content: string;
        }>;
        pageInfo: {
          nextCursor: string | null;
          hasNextPage: boolean;
        };
      };
    }

    const searchRes = await executeGraphQL<SearchDocsData>(searchDocsQuery, {
      search: "architecture",
      collectionId,
    });

    expect(searchRes.errors).toBeUndefined();
    expect(searchRes.data?.documents.items.length).toBe(1);
    expect(searchRes.data?.documents.items[0]?.id).toBe(documentId);

    // ----------------------------------------------------
    // Step 5: Update Document (Soft Archive)
    // ----------------------------------------------------
    const updateDocMutation = `
      mutation UpdateDoc($id: ID!, $input: UpdateDocumentInput!) {
        updateDocument(id: $id, input: $input) {
          id
          isArchived
        }
      }
    `;

    interface UpdateDocData {
      updateDocument: {
        id: string;
        isArchived: boolean;
      };
    }

    const updateRes = await executeGraphQL<UpdateDocData>(updateDocMutation, {
      id: documentId,
      input: {
        isArchived: true,
      },
    });

    expect(updateRes.errors).toBeUndefined();
    expect(updateRes.data?.updateDocument.isArchived).toBe(true);

    // Verify change in PostgreSQL
    const updatedDbDoc = await testPrisma.document.findUnique({
      where: { id: documentId },
    });
    expect(updatedDbDoc?.isArchived).toBe(true);

    // ----------------------------------------------------
    // Step 6: Delete Document
    // ----------------------------------------------------
    const deleteDocMutation = `
      mutation DeleteDoc($id: ID!) {
        deleteDocument(id: $id)
      }
    `;

    interface DeleteDocData {
      deleteDocument: boolean;
    }

    const deleteRes = await executeGraphQL<DeleteDocData>(deleteDocMutation, {
      id: documentId,
    });

    expect(deleteRes.errors).toBeUndefined();
    expect(deleteRes.data?.deleteDocument).toBe(true);

    // Verify record was completely removed from PostgreSQL
    const deletedDbDoc = await testPrisma.document.findUnique({
      where: { id: documentId },
    });
    expect(deletedDbDoc).toBeNull();
  });
});
