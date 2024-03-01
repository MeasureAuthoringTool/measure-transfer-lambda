import { parseError } from "../../../src/utils/resultutils";

describe("resultutils", () => {
  it("parse validation errors", () => {
    const errorMessage = {
      timestamp: "2024-01-22T19:55:30.492+00:00",
      status: 400,
      error: "Bad Request",
      message: "Validation failed for object='measure'. Error count: 1",
      validationErrors: {
        cqlLibraryName: "CQL library with given name already exists.",
        measureName: "Measure Name is required.",
      },
    };
    const result = parseError(errorMessage?.validationErrors, errorMessage?.message);
    expect(result).toEqual("1. CQL library with given name already exists.\n2. Measure Name is required.");
  });
  it("parser message from the error", () => {
    const result = parseError(null, "This is just an error");
    expect(result).toEqual("This is just an error");
  });
});
