export class TimelineDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimelineDataError";
  }
}

export class UnsupportedManifestVersionError extends TimelineDataError {
  constructor(version: unknown) {
    super(
      `Unsupported manifest version "${String(version)}". This viewer currently supports version 1 only.`,
    );
    this.name = "UnsupportedManifestVersionError";
  }
}

export class MissingTimelineDataError extends TimelineDataError {
  constructor(message: string) {
    super(message);
    this.name = "MissingTimelineDataError";
  }
}
