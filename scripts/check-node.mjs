const expectedMajor = 22;
const actualVersion = process.versions.node;
const actualMajor = Number(actualVersion.split(".")[0]);

if (actualMajor < expectedMajor) {
  console.warn(
    `[bootstrap] Expected Node ${expectedMajor}.x from .nvmrc/.node-version, but found ${actualVersion}.`,
  );
  console.warn(
    "[bootstrap] Install will continue, but switch to Node 22 before regular development to avoid toolchain drift.",
  );
}
