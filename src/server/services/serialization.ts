export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function compactText(value: string, maxLength = 180): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length <= maxLength ? compacted : `${compacted.slice(0, maxLength)}...`;
}

export function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
