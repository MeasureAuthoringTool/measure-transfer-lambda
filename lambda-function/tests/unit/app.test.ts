import { S3Event } from "aws-lambda";
import { Readable } from "stream";
import { lambdaHandler } from "../../src/app";
import { s3Client } from "../../src/s3Client";
import measure from "./fixtures/measure.json";
import putEvent from "./fixtures/s3PutEvent.json";

jest.mock("@aws-sdk/client-s3");

describe("Unit test for lambda handler", () => {
  let event: S3Event;
  let readableDataStream: Readable;
  beforeEach(() => {
    jest.resetAllMocks();
    event = putEvent as S3Event;
    readableDataStream = new Readable();
    readableDataStream.push(JSON.stringify(measure));
    readableDataStream.push(null);
  });

  it("reads and returns s3 object successfully", async () => {
    s3Client.send.mockResolvedValue({ ContentType: "binary/octet-stream", Body: readableDataStream });

    const data = await lambdaHandler(event);
    expect(data).toEqual(JSON.stringify(measure));
  });

  it("handles s3 exception if any", async () => {
    s3Client.send.mockImplementation(() => {
      throw new Error("Connection error");
    });

    try {
      await lambdaHandler(event);
    } catch (exception) {
      expect(exception.message).toEqual(
        "Error getting object test/key from bucket example-bucket. Make sure they exist and your bucket is in the same region as this function.",
      );
    }
  });
});
