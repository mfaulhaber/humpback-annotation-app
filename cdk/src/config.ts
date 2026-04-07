import type { Environment } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

export const STATIC_VIEWER_REGION = "us-west-2" as const;

export interface StaticViewerCdkConfig {
  stackName: string;
  env: Environment;
  priceClass: cloudfront.PriceClass;
  appBucketName?: string;
  dataBucketName?: string;
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
}

const PRICE_CLASS_MAP: Record<string, cloudfront.PriceClass> = {
  PriceClass_100: cloudfront.PriceClass.PRICE_CLASS_100,
  PriceClass_200: cloudfront.PriceClass.PRICE_CLASS_200,
  PriceClass_All: cloudfront.PriceClass.PRICE_CLASS_ALL,
};

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parsePriceClass(value: string | undefined): cloudfront.PriceClass {
  if (!value) {
    return cloudfront.PriceClass.PRICE_CLASS_100;
  }

  const parsed = PRICE_CLASS_MAP[value];
  if (!parsed) {
    throw new Error(
      `Unsupported STATIC_VIEWER_PRICE_CLASS "${value}". Use one of: ${Object.keys(
        PRICE_CLASS_MAP,
      ).join(", ")}.`,
    );
  }

  return parsed;
}

export function loadStaticViewerConfig(): StaticViewerCdkConfig {
  const stackName =
    readOptionalEnv("STATIC_VIEWER_STACK_NAME") ?? "humpback-static-viewer";
  const appBucketName = readOptionalEnv("STATIC_VIEWER_APP_BUCKET_NAME");
  const dataBucketName = readOptionalEnv("STATIC_VIEWER_DATA_BUCKET_NAME");
  const domainName = readOptionalEnv("STATIC_VIEWER_DOMAIN_NAME");
  const certificateArn = readOptionalEnv("STATIC_VIEWER_CERTIFICATE_ARN");
  const hostedZoneId = readOptionalEnv("STATIC_VIEWER_HOSTED_ZONE_ID");
  const hostedZoneName = readOptionalEnv("STATIC_VIEWER_HOSTED_ZONE_NAME");
  const cdkAccount = readOptionalEnv("CDK_DEFAULT_ACCOUNT");

  if ((domainName && !certificateArn) || (!domainName && certificateArn)) {
    throw new Error(
      "Custom domain configuration requires both STATIC_VIEWER_DOMAIN_NAME and STATIC_VIEWER_CERTIFICATE_ARN.",
    );
  }

  if ((hostedZoneId && !hostedZoneName) || (!hostedZoneId && hostedZoneName)) {
    throw new Error(
      "Route 53 alias creation requires both STATIC_VIEWER_HOSTED_ZONE_ID and STATIC_VIEWER_HOSTED_ZONE_NAME.",
    );
  }

  if ((hostedZoneId || hostedZoneName) && !domainName) {
    throw new Error(
      "Route 53 alias creation requires STATIC_VIEWER_DOMAIN_NAME to be set.",
    );
  }

  const env: Environment = {
    region: STATIC_VIEWER_REGION,
    ...(cdkAccount ? { account: cdkAccount } : {}),
  };

  return {
    stackName,
    env,
    priceClass: parsePriceClass(readOptionalEnv("STATIC_VIEWER_PRICE_CLASS")),
    ...(appBucketName ? { appBucketName } : {}),
    ...(dataBucketName ? { dataBucketName } : {}),
    ...(domainName ? { domainName } : {}),
    ...(certificateArn ? { certificateArn } : {}),
    ...(hostedZoneId ? { hostedZoneId } : {}),
    ...(hostedZoneName ? { hostedZoneName } : {}),
  };
}
