// S3 region & endpoint
export const REGION = process.env.AWS_REGION || "us-east-1";
export const S3_ENDPOINT = process.env.AWS_S3_ENDPOINT || "http://localhost:4566";

// default pathStyle for localstack must be true
export const FORCE_PATH_STYLE = process.env.FORCE_PATH_STYLE !== "false";

// MADiE env vars
export const MADiE_SERVICE_URL = process.env.MADiE_SERVICE_URL || "http://localhost:8083/api";
export const MADiE_API_KEY = process.env.MADiE_API_KEY || "9202c9fa";

export const SMTP_HOSTNAME = process.env.SMTP_HOST_NAME;
export const SMTP_PORT = process.env.SMTP_PORT;
export const SMTP_USERNAME = process.env.SMTP_USERNAME;
export const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
export const SMTP_TLS = process.env.SMTP_TLS;
export const FROM_EMAIL = process.env.FROM_EMAIL;
