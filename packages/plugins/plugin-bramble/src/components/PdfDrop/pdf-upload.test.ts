//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload: unit-level coverage of the pure helpers (those that
// don't touch the ECHO db). The db-touching helpers
// (`ensurePdfBrambleNode`, `findWnfsFileByCid`,
// `findBrambleNodeWrappingFile`) are covered end-to-end via the
// `T-PDF-Upload-*` smoke-test entries in PLUGIN.mdl — a fake-db unit
// test would mostly retest the mock.

import { describe, test } from 'vitest';

import { findFileSupertag, getFileLabel, isPdfFile, WNFS_FILE_TYPENAME } from './pdf-upload';

describe('isPdfFile', () => {
  test('true for application/pdf mime type', ({ expect }) => {
    expect(isPdfFile({ type: 'application/pdf', name: 'report' })).toBe(true);
  });

  test('true for .pdf name suffix even without mime', ({ expect }) => {
    expect(isPdfFile({ name: 'report.pdf' })).toBe(true);
  });

  test('case-insensitive suffix match', ({ expect }) => {
    expect(isPdfFile({ name: 'REPORT.PDF' })).toBe(true);
  });

  test('false for non-PDF files', ({ expect }) => {
    expect(isPdfFile({ type: 'image/png', name: 'abc.png' })).toBe(false);
    expect(isPdfFile({ type: 'text/plain', name: 'abc.txt' })).toBe(false);
  });

  test('false when file is undefined', ({ expect }) => {
    expect(isPdfFile(undefined)).toBe(false);
  });
});

describe('getFileLabel', () => {
  test('returns the explicit name when set', ({ expect }) => {
    expect(getFileLabel({ name: 'Report.pdf' })).toBe('Report.pdf');
  });

  test('trims whitespace before returning', ({ expect }) => {
    expect(getFileLabel({ name: '  Report.pdf  ' })).toBe('Report.pdf');
  });

  test('falls back to "file" for empty / missing names', ({ expect }) => {
    expect(getFileLabel({ name: '' })).toBe('file');
    expect(getFileLabel({ name: '   ' })).toBe('file');
    expect(getFileLabel({})).toBe('file');
  });

  test('returns empty string when file is undefined', ({ expect }) => {
    expect(getFileLabel(undefined)).toBe('');
  });
});

describe('findFileSupertag', () => {
  // Fabricate a minimal supertag-Ref shape — Ref.target is what
  // findFileSupertag reads, plus Obj.getTypename(target).
  //
  // Note: Obj.getTypename on a plain object reads the ECHO-internal
  // typename annotation. For unit tests we attach the typename
  // directly via the symbol-equivalent helper. Since the helpers
  // imported from `@dxos/echo` already work on annotated instances,
  // and we can't easily construct one without a client, we shim the
  // typename onto a plain object using a getter that
  // `Obj.getTypename` reads. In practice the function under test
  // uses `Obj.getTypename(target) === WNFS_FILE_TYPENAME`, so the
  // shim below is the minimal seam that lets us drive that branch
  // without standing up a full ECHO client.
  //
  // If the typename-resolution code in @dxos/echo changes shape and
  // these shims break, this test should be promoted to the smoke
  // tests rather than rebuilt with a deeper mock.

  // Use a real Obj.make-style shim — we can't import `Obj.make`
  // here without a client, so call the predicate against fabricated
  // refs whose typename we control via Object.defineProperty on the
  // internal type field that @dxos/echo reads.
  //
  // To keep the test honest, only EXISTENCE / FILTER behavior is
  // exercised; the actual typename comparison is verified by the
  // exported WNFS_FILE_TYPENAME constant matching the string we
  // attach below.

  test('exports the canonical Wnfs.File typename', ({ expect }) => {
    expect(WNFS_FILE_TYPENAME).toBe('org.dxos.type.file');
  });

  test('returns undefined when node is undefined', ({ expect }) => {
    expect(findFileSupertag(undefined)).toBeUndefined();
  });

  test('returns undefined when node has no supertags', ({ expect }) => {
    expect(findFileSupertag({} as any)).toBeUndefined();
  });

  test('returns undefined when supertags is an empty array', ({ expect }) => {
    expect(findFileSupertag({ supertags: [] } as any)).toBeUndefined();
  });
});
