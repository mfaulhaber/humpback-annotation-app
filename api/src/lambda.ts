import awsLambdaFastify from "@fastify/aws-lambda";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const app = buildApp(config);

export const handler = awsLambdaFastify(app);
