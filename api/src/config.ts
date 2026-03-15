export interface Config {
  appEnv: "local" | "dev" | "staging" | "prod";
  dynamoEndpoint: string | undefined;
  catalogTable: string;
  labelsTable: string;
  mediaRoot: string;
  authMode: "dev" | "cognito";
  awsRegion: string;
  apiPort: number;
}

export function loadConfig(): Config {
  const appEnv = (process.env["APP_ENV"] ?? "local") as Config["appEnv"];
  return {
    appEnv,
    dynamoEndpoint:
      process.env["DYNAMODB_ENDPOINT"] ??
      (appEnv === "local" ? "http://localhost:8000" : undefined),
    catalogTable: process.env["CATALOG_TABLE"] ?? "Catalog",
    labelsTable: process.env["LABELS_TABLE"] ?? "Labels",
    mediaRoot: process.env["MEDIA_ROOT"] ?? "./local_media",
    authMode: (process.env["AUTH_MODE"] ?? "dev") as Config["authMode"],
    awsRegion: process.env["AWS_REGION"] ?? "us-west-2",
    apiPort: parseInt(process.env["API_PORT"] ?? "3001", 10),
  };
}
