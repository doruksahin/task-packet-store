/** Anchored glob: the pattern starts with "/", "*" matches one segment, "**" matches zero or more. */
export function matchesGlob(pattern: string, relativePath: string): boolean {
  if (!pattern.startsWith('/')) throw new Error(`glob must be anchored with "/": ${pattern}`);
  return match(pattern.slice(1).split('/'), relativePath.split('/'));
}

function match(pattern: string[], segments: string[]): boolean {
  if (pattern.length === 0) return segments.length === 0;
  const [head, ...rest] = pattern;
  if (head === '**') return match(rest, segments) || (segments.length > 0 && match(pattern, segments.slice(1)));
  if (segments.length === 0) return false;
  if (head === '*' || head === segments[0]) return match(rest, segments.slice(1));
  return false;
}

export function matchesAny(patterns: readonly string[] | undefined, relativePath: string): boolean {
  return (patterns ?? []).some((pattern) => matchesGlob(pattern, relativePath));
}
