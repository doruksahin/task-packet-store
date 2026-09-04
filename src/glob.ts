function patternSegments(pattern: string): string[] {
  if (!pattern.startsWith('/')) throw new Error(`glob must be anchored with "/": ${pattern}`);
  const segments = pattern.slice(1).split('/');
  for (const segment of segments) {
    if (segment.includes('*') && segment !== '*' && segment !== '**') {
      throw new Error(`glob segment must be a literal, "*", or "**": ${segment}`);
    }
  }
  return segments;
}

/** Anchored glob: the pattern starts with "/", "*" matches one segment, "**" matches zero or more. */
export function matchesGlob(pattern: string, relativePath: string): boolean {
  return match(patternSegments(pattern), relativePath.split('/'));
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
  const parsed = (patterns ?? []).map(patternSegments);
  return parsed.some((pattern) => match(pattern, relativePath.split('/')));
}
