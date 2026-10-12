export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function workspaceGuideStorageKey(userId: number): string {
  return `litigaforge:forge-workspace-guide:v1:user:${userId}`;
}

export function readWorkspaceGuideProgress(
  storage: ProgressStorage,
  userId: number,
  validLessonIds: readonly string[],
): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(workspaceGuideStorageKey(userId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is string => typeof id === "string" && validLessonIds.includes(id),
    );
  } catch {
    return [];
  }
}

export function writeWorkspaceGuideProgress(
  storage: ProgressStorage,
  userId: number,
  completed: readonly string[],
): void {
  try {
    storage.setItem(workspaceGuideStorageKey(userId), JSON.stringify(completed));
  } catch {
    // Keep this visit usable when browser storage is unavailable.
  }
}
