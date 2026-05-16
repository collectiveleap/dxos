//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload: unit-level coverage of the pure helpers. The
// drop-target component itself is covered end-to-end via the
// browser smoke-test entry in PLUGIN.mdl (T-PDF-Upload-*).

import { describe, test } from 'vitest';

import { getAttachmentLabel, isPdfAttachment, sha256Hex } from './pdf-upload';

describe('sha256Hex', () => {
  test('produces a 64-char hex digest', async ({ expect }) => {
    const bytes = new TextEncoder().encode('hello world');
    const digest = await sha256Hex(bytes);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  test('same bytes hash to the same digest', async ({ expect }) => {
    const a = await sha256Hex(new TextEncoder().encode('same payload'));
    const b = await sha256Hex(new TextEncoder().encode('same payload'));
    expect(a).toBe(b);
  });

  test('different bytes hash to different digests', async ({ expect }) => {
    const a = await sha256Hex(new TextEncoder().encode('payload one'));
    const b = await sha256Hex(new TextEncoder().encode('payload two'));
    expect(a).not.toBe(b);
  });

  test('matches the canonical SHA-256 of the empty input', async ({ expect }) => {
    const digest = await sha256Hex(new Uint8Array(0));
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('isPdfAttachment', () => {
  test('true for application/pdf mime type', ({ expect }) => {
    expect(isPdfAttachment({ kind: 'file', url: 'wnfs:///abc', mimeType: 'application/pdf' })).toBe(true);
  });

  test('true for .pdf url suffix even without mime', ({ expect }) => {
    expect(isPdfAttachment({ kind: 'file', url: 'wnfs:///abc.pdf' })).toBe(true);
  });

  test('false for non-PDF attachments', ({ expect }) => {
    expect(isPdfAttachment({ kind: 'image', url: 'wnfs:///abc.png' })).toBe(false);
    expect(isPdfAttachment({ kind: 'file', url: 'wnfs:///abc.txt', mimeType: 'text/plain' })).toBe(false);
  });

  test('false when attachment is undefined', ({ expect }) => {
    expect(isPdfAttachment(undefined)).toBe(false);
  });
});

describe('getAttachmentLabel', () => {
  test('returns the explicit name when set', ({ expect }) => {
    expect(getAttachmentLabel({ kind: 'file', url: 'wnfs:///x', name: 'Report.pdf' })).toBe('Report.pdf');
  });

  test('falls back to the URL\'s last segment when name is absent', ({ expect }) => {
    expect(getAttachmentLabel({ kind: 'file', url: 'wnfs:///bafy.../Report.pdf' })).toBe('Report.pdf');
  });

  test('strips query and hash before extracting the segment', ({ expect }) => {
    expect(getAttachmentLabel({ kind: 'file', url: 'https://example.com/a/b/c.pdf?token=xyz#frag' })).toBe('c.pdf');
  });

  test('falls back to "file" for empty/odd URLs', ({ expect }) => {
    expect(getAttachmentLabel({ kind: 'file', url: '' })).toBe('file');
  });
});
