//
// Copyright 2026 DXOS.org
//

/** Tracking query params stripped by {@link canonicalizeUrl}, matched case-insensitively. */
const TRACKING_PARAM_NAMES = new Set(['fbclid', 'gclid', 'mc_eid', 'ref', 'ref_src']);

const isTrackingParam = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAM_NAMES.has(lower);
};

/**
 * Normalizes a URL into a canonical dedup key, so referents captured from different sources (a
 * Readwise article, a Bluesky post linking the same article) can be identified as the same thing.
 * The output is a **dedup key, not for display**.
 *
 * This is an **allowlist** canonicalization: it only ever removes query params known to be
 * tracking noise, and never strips an unknown param (`?id=123` can be load-bearing). It never
 * follows redirects and never fuzzy-matches titles — two URLs cluster only if identical after
 * this normalization. Missed clusters are an acceptable cost; a false merge is not.
 *
 * Rules applied:
 * - Lowercases the scheme and host.
 * - Drops a default port (`:80` for http, `:443` for https).
 * - Strips a trailing slash from the path, except the root path (`/` is kept as `/`).
 * - Removes `utm_*`, `fbclid`, `gclid`, `mc_eid`, `ref`, `ref_src` query params (case-insensitive
 *   name match); every other query param is kept as-is.
 * - Drops the fragment.
 *
 * Returns `''` for an empty or unparseable URL.
 */
export const canonicalizeUrl = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
    parsed.port = '';
  }

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  for (const name of [...parsed.searchParams.keys()]) {
    if (isTrackingParam(name)) {
      parsed.searchParams.delete(name);
    }
  }

  parsed.hash = '';

  return parsed.toString();
};
