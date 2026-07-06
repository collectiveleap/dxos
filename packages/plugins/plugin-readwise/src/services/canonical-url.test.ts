//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { canonicalizeUrl } from './canonical-url';

describe('canonicalizeUrl', () => {
  test('strips known tracking params but keeps other query params', ({ expect }) => {
    const result = canonicalizeUrl('https://example.com/article?id=123&utm_source=newsletter&fbclid=abc');
    expect(result).toBe('https://example.com/article?id=123');
  });

  test('normalizes scheme case, host case, and a trailing slash', ({ expect }) => {
    expect(canonicalizeUrl('HTTP://Example.com/')).toBe('http://example.com/');
    expect(canonicalizeUrl('https://example.com/article/')).toBe('https://example.com/article');
  });

  test('two equivalent URLs canonicalize to the same key', ({ expect }) => {
    expect(canonicalizeUrl('HTTP://Example.com/')).toBe(canonicalizeUrl('http://example.com')); // both '/' root
  });

  test('drops the fragment', ({ expect }) => {
    expect(canonicalizeUrl('https://example.com/article#section-2')).toBe('https://example.com/article');
  });

  test('returns an empty string for an empty or unparseable URL', ({ expect }) => {
    expect(canonicalizeUrl('')).toBe('');
    expect(canonicalizeUrl('not a url')).toBe('');
  });
});
