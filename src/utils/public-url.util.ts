export function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function isLocalUrl(value: string) {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(
    value,
  );
}

export function splitUrlCandidates(value: string) {
  return value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolvePublicUrl(...values: Array<string | undefined>) {
  for (const value of values) {
    const raw = value?.trim();

    if (!raw) continue;

    const candidates = splitUrlCandidates(raw);

    for (const candidate of candidates) {
      const normalizedCandidate = trimTrailingSlash(candidate);

      if (/^https?:\/\//i.test(normalizedCandidate) && !isLocalUrl(normalizedCandidate)) {
        return normalizedCandidate;
      }
    }

    for (const candidate of candidates) {
      const normalizedCandidate = trimTrailingSlash(candidate);

      if (/^https?:\/\//i.test(normalizedCandidate)) {
        return normalizedCandidate;
      }

      if (!isLocalUrl(normalizedCandidate)) {
        return `https://${normalizedCandidate.replace(/^\/+/, '')}`;
      }
    }
  }

  return '';
}
