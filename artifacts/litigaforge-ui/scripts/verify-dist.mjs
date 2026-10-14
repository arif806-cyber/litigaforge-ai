import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDist = resolve(packageDir, "dist/public");

export function verifyFrontendDist({
  distDir = defaultDist,
  basePath = process.env.BASE_PATH ?? "/",
  nodeEnv = process.env.NODE_ENV ?? "",
} = {}) {
  const root = resolve(distDir);
  const indexPath = resolve(root, "index.html");

  if (nodeEnv === "production" && basePath !== "/") {
    throw new Error(
      `Frontend production build must use BASE_PATH=/ because the API server serves it at /. Received BASE_PATH=${basePath}`,
    );
  }
  if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
    throw new Error(`Frontend build is missing ${indexPath}`);
  }

  const html = readFileSync(indexPath, "utf8");
  const urls = new Set(
    [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map((match) => match[1].split(/[?#]/, 1)[0])
      .filter((url) => url.startsWith("/") && !url.startsWith("//") && /\.(?:m?js|css)$/i.test(url)),
  );
  const missing = [];

  for (const url of urls) {
    const assetPath = resolve(root, decodeURIComponent(url).replace(/^\/+/, ""));
    const fromRoot = relative(root, assetPath);
    if (
      fromRoot === ".." ||
      fromRoot.startsWith(`..${sep}`) ||
      !existsSync(assetPath) ||
      !statSync(assetPath).isFile()
    ) {
      missing.push(url);
    }
  }

  if (![...urls].some((url) => /\.js$/i.test(url)) ||
      ![...urls].some((url) => /\.css$/i.test(url))) {
    throw new Error(`Frontend index has no complete JS/CSS asset set in ${root}; references: ${[...urls].join(", ") || "(none)"}`);
  }
  if (missing.length) {
    throw new Error(`Frontend build is missing assets referenced by index.html: ${missing.join(", ")}`);
  }
  console.log(`Verified frontend index and ${urls.size} referenced JS/CSS assets in ${root}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyFrontendDist();
}
