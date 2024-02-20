/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "babel",
  testMatch: ["**/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^axios$": require.resolve("axios"),
  },
};
