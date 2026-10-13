import type { ConnectFlags } from "@/hooks/use-connect-v2";
import { INDIAN_LANGUAGES } from "@/hooks/use-connect-v2";

export function ConnectLanguageSelect({
  flags,
  value,
  onChange,
  id = "preferred-language",
}: {
  flags?: ConnectFlags;
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const reviewed = new Set(flags?.languages_needing_review ?? []);
  const allLanguages = [...INDIAN_LANGUAGES.phase1, ...INDIAN_LANGUAGES.phase2, ...INDIAN_LANGUAGES.phase3];
  const resolvePhase = (codes: unknown, fallback: typeof INDIAN_LANGUAGES.phase1) => {
    if (!Array.isArray(codes)) return fallback;
    return codes.map((code) => allLanguages.find((item) => item.code === code)).filter((item): item is (typeof allLanguages)[number] => !!item);
  };
  const phase1 = resolvePhase(flags?.phase1, INDIAN_LANGUAGES.phase1);
  const phase2 = resolvePhase(flags?.phase2, []);
  const phase3 = resolvePhase(flags?.phase3, []);
  const option = (item: { code: string; name: string; native: string }) => (
    <option key={item.code} value={item.code}>
      {item.native} — {item.name}{reviewed.has(item.code) ? " · needs review" : ""}
    </option>
  );

  return (
    <select
      id={id}
      data-testid="select-preferred-language"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <optgroup label="Available now">{phase1.map(option)}</optgroup>
      {phase2.length > 0 && <optgroup label="Available · needs review">{phase2.map(option)}</optgroup>}
      {phase3.length > 0 && <optgroup label="More languages — beta · original shown alongside">{phase3.map(option)}</optgroup>}
    </select>
  );
}
