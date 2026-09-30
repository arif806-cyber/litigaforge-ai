/** Keep titles readable for search results without cutting through a word. */
export function truncateTitle(value: string, maxLength = 70): string {
  const title = value.trim();
  if (title.length <= maxLength) return title;
  const boundary = title.slice(0, maxLength + 1).lastIndexOf(" ");
  return `${title.slice(0, boundary > 0 ? boundary : maxLength).trim()}…`;
}