import { S3Client } from "@aws-sdk/client-s3";

// S3 region & endpoint
const REGION = process.env.AWS_REGION || "us-east-1";
const S3_ENDPOINT = process.env.AWS_S3_ENDPOINT || "http://localhost:4566";
console.log(`S3 Region: ${REGION}, S3 endpoint: ${S3_ENDPOINT}`);

// default pathStyle for localstack must be true
const FORCE_PATH_STYLE = process.env.FORCE_PATH_STYLE !== "false";

const s3Client = new S3Client({
  region: REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,
});

export { s3Client };
