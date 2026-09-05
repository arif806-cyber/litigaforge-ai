export interface JudgmentResolveResponse {
  exact?: boolean;
  path?: string;
}

export type ResolveJudgment = (
  court: string,
  year: string,
  slug: string,
) => Promise<JudgmentResolveResponse | null>;

export async function judgmentRedirectTarget(
  reqPath: string,
  stripCountry: (path: string) => string,
  resolveJudgment: ResolveJudgment,
): Promise<string | null> {
  let bare = stripCountry(reqPath);
  if (bare.length > 1) bare = bare.replace(/\/+$/, "");
  const match = bare.match(/^\/judgments\/([^/]+)\/(\d{4})\/([^/]+)$/);
  if (!match) return null;

  const [, court, year, slug] = match;
  const prefix =
    stripCountry(reqPath) === reqPath
      ? ""
      : `/${reqPath.replace(/^\/+/, "").split("/")[0]?.toLowerCase() ?? ""}`;
  const data = await resolveJudgment(court!, year!, slug!);

  if (
    !data ||
    data.exact !== false ||
    !data.path ||
    data.path === bare
  ) {
    return null;
  }
  return `${prefix}${data.path}`;
}