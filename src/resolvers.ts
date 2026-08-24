/**
 * Resolver map for the GraphQL schema.
 *
 * Each top-level key corresponds to a type in schema.graphql.
 * Each nested key corresponds to a field on that type.
 */

const resolvers = {
  Query: {
    health: (): string => "🟢 Document Vault API is running",
  },
};

export default resolvers;
