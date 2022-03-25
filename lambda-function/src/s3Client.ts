import { S3Client } from "@aws-sdk/client-s3";
import { REGION, S3_ENDPOINT, FORCE_PATH_STYLE } from "./configs/configs";

const s3Client = new S3Client({
  region: REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,
});

export { s3Client };
