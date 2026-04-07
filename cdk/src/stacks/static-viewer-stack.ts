import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import {
  STATIC_VIEWER_REGION,
  type StaticViewerCdkConfig,
} from "../config.js";

interface StaticViewerStackProps extends StackProps {
  config: StaticViewerCdkConfig;
}

export class StaticViewerStack extends Stack {
  constructor(scope: Construct, id: string, props: StaticViewerStackProps) {
    super(scope, id, props);

    const { config } = props;

    const appBucket = new s3.Bucket(this, "ViewerAppBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
      ...(config.appBucketName ? { bucketName: config.appBucketName } : {}),
    });

    const dataBucket = new s3.Bucket(this, "TimelineDataBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
      ...(config.dataBucketName ? { bucketName: config.dataBucketName } : {}),
    });

    const appOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      appBucket as unknown as s3.IBucket,
    );
    const dataOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      dataBucket as unknown as s3.IBucket,
    );

    const appRouteRewrite = new cloudfront.Function(this, "AppRouteRewrite", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (
    uri === "/" ||
    uri.startsWith("/assets/") ||
    uri.startsWith("/data/") ||
    uri.includes(".")
  ) {
    return request;
  }

  request.uri = "/index.html";
  return request;
}
`),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const dataPrefixRewrite = new cloudfront.Function(
      this,
      "DataPrefixRewrite",
      {
        code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/data") {
    request.uri = "/index.json";
    return request;
  }

  if (uri.startsWith("/data/")) {
    request.uri = uri.slice(5);
  }

  return request;
}
`),
        runtime: cloudfront.FunctionRuntime.JS_2_0,
      },
    );

    const distribution = new cloudfront.Distribution(
      this,
      "StaticViewerDistribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: appOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          responseHeadersPolicy:
            cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
          functionAssociations: [
            {
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
              function: appRouteRewrite,
            },
          ],
        },
        additionalBehaviors: {
          "/assets/*": {
            origin: appOrigin,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            compress: true,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            responseHeadersPolicy:
              cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
          },
          "/data/*": {
            origin: dataOrigin,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            compress: true,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            responseHeadersPolicy:
              cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
            functionAssociations: [
              {
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                function: dataPrefixRewrite,
              },
            ],
          },
        },
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        priceClass: config.priceClass,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        ...(config.domainName && config.certificateArn
          ? {
              domainNames: [config.domainName],
              certificate: acm.Certificate.fromCertificateArn(
                this,
                "ViewerCertificate",
                config.certificateArn,
              ),
            }
          : {}),
      },
    );

    if (config.hostedZoneId && config.hostedZoneName && config.domainName) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        "ViewerHostedZone",
        {
          hostedZoneId: config.hostedZoneId,
          zoneName: config.hostedZoneName,
        },
      );

      new route53.ARecord(this, "ViewerAliasRecord", {
        recordName: config.domainName,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution),
        ),
        zone: hostedZone,
      });

      new route53.AaaaRecord(this, "ViewerAliasRecordIpv6", {
        recordName: config.domainName,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution),
        ),
        zone: hostedZone,
      });
    }

    const publicDomain = config.domainName ?? distribution.domainName;

    new CfnOutput(this, "StaticViewerRegion", {
      value: STATIC_VIEWER_REGION,
    });
    new CfnOutput(this, "StaticViewerAppBucketName", {
      value: appBucket.bucketName,
    });
    new CfnOutput(this, "StaticViewerDataBucketName", {
      value: dataBucket.bucketName,
    });
    new CfnOutput(this, "StaticViewerDistributionId", {
      value: distribution.distributionId,
    });
    new CfnOutput(this, "StaticViewerDistributionDomainName", {
      value: distribution.distributionDomainName,
    });
    new CfnOutput(this, "StaticViewerUrl", {
      value: `https://${publicDomain}`,
    });
    new CfnOutput(this, "StaticViewerDataUrl", {
      value: `https://${publicDomain}/data/index.json`,
    });
  }
}
