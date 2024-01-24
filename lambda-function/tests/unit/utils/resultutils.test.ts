import { parseError } from "../../../src/utils/resultutils";

describe("resultutils", () => {
  it("parses json correctly", () => {
    const jsonString =
      '{"timestamp":"2024-01-22T19:55:30.492+00:00","status":400,"error":"Bad Request","message":"CQL library with given name already exists.","validationErrors":{"cqlLibraryName":"CQL library with given name already exists."}}';
    const result = parseError(jsonString);
    expect(result).toEqual("CQL library with given name already exists.");
  });
  it("doesn't parse when not json", () => {
    const jsonString = "This is just an error";
    const result = parseError(jsonString);
    expect(result).toEqual("This is just an error");
  });
  it.only("Parses JSON that isn't a correct ErrorMessage", () => {
    const jsonString = '{"result":"This is just an error"}';
    const result = parseError(jsonString);
    expect(result).toEqual('{"result":"This is just an error"}');
  });
});
