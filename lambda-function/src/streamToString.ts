import { Readable } from "stream";

export const streamToString = async (stream: Readable): Promise<string> => {
  console.log("Processing the stream and converting to string...");
  return await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}