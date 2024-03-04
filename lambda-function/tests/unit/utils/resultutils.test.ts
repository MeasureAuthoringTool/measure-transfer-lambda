import { parseError } from "../../../src/utils/resultutils";

describe("resultutils", () => {
  it("parse errors when there are multiple validation errors", () => {
    const errorMessage =
      '{"timestamp":"2024-03-04T15:41:15.752+00:00","status":400,"error":"Bad Request","message":"CQL library with given name already exists.","validationErrors":{"cqlLibraryName":"CQL library with given name already exists.","measureName":"Measure with given name already exists."}}';
    const result = parseError(errorMessage);
    expect(result).toEqual(
      "1. CQL library with given name already exists.\n2. Measure with given name already exists.",
    );
  });

  it("parse errors when there is only one validation error", () => {
    const errorMessage =
      '{"timestamp":"2024-01-22T19:55:30.492+00:00","status":400,"error":"Bad Request","message":"CQL library with given name already exists.","validationErrors":{"cqlLibraryName":"CQL library with given name already exists."}}';
    const result = parseError(errorMessage);
    expect(result).toEqual("CQL library with given name already exists.");
  });

  it("parser message from the error", () => {
    const jsonString = "This is just an error";
    const result = parseError(jsonString);
    expect(result).toEqual("This is just an error");
  });
});
