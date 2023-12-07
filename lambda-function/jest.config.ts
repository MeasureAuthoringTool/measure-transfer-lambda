/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  transform: { "\\.[jt]sx?$": "babel-jest" },
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  testMatch: ["**/tests/unit/*.test.ts"],
  moduleNameMapper: {
    "^axios$": require.resolve("axios"),
  },
};
