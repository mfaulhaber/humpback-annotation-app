import path from "node:path";

export function resolvePathWithinRoot(
  root: string,
  requestedPath: string,
): string | null {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, requestedPath);
  const relativePath = path.relative(resolvedRoot, resolvedPath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return resolvedPath;
}
