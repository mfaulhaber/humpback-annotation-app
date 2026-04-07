import { App } from "aws-cdk-lib";
import { loadStaticViewerConfig } from "./config.js";
import { StaticViewerStack } from "./stacks/static-viewer-stack.js";

export function buildStaticViewerApp(): App {
  const app = new App();
  const config = loadStaticViewerConfig();

  new StaticViewerStack(app, "StaticViewerStack", {
    stackName: config.stackName,
    env: config.env,
    config,
  });

  return app;
}
