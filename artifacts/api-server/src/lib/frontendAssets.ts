import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const LOCAL_SCRIPT_OR_STYLE = /\.(?:m?js|css)$/i;

export function missingFrontendAssets(html: string, distDir: string): string[] {
  const root = resolve(distDir);
  const urls = new Set(
    [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map((match) => match[1].split(/[?#]/, 1)[0])
      .filter((url) => url.startsWith("/") && !url.startsWith("//") && LOCAL_SCRIPT_OR_STYLE.test(url)),
  );

  return [...urls].filter((url) => {
    const filePath = resolve(root, url.replace(/^\/+/, ""));
    const fromRoot = relative(root, filePath);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return true;
    return !existsSync(filePath);
  });
}
