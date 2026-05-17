//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload.chip-rendering: a small non-interactive PDF icon
// rendered AFTER the bullet's #File supertag chip — a visual
// indicator that the wrapped Wnfs.File is a PDF. NOT a link.
// The user opens the PDF via the #File supertag's normal
// navigation affordances (chip click → tag Node,
// OpenInstanceControl → the specific Wnfs.File), not via this
// icon.

import React from 'react';

import { getFileLabel } from './pdf-upload';

export type PdfChipProps = {
  // The Wnfs.File that the bullet's Bramble.Node wraps via a
  // supertag Ref. Treated as opaque (typed `any`) to avoid a
  // compile-time dependency on `@dxos/plugin-wnfs`. Used here
  // only for the icon's tooltip (the filename surfaces on
  // hover for context — but the icon itself does nothing on
  // click).
  wnfsFile: any;
};

export const PdfChip = ({ wnfsFile }: PdfChipProps) => {
  const tooltip = getFileLabel(wnfsFile);

  return (
    <span
      className='inline-flex items-center shrink-0 text-rose-600 dark:text-rose-400 align-baseline'
      aria-label='PDF'
      title={tooltip}
      data-bramble-pdf-chip
    >
      <svg
        width='14'
        height='14'
        viewBox='0 0 256 256'
        fill='currentColor'
        aria-hidden
      >
        {/* Inlined Phosphor `ph--file-pdf--regular` glyph. */}
        <path d='M213.66 82.34l-56-56A8 8 0 0 0 152 24H56a16 16 0 0 0-16 16v176a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V88a8 8 0 0 0-2.34-5.66ZM152 40l48 48h-48ZM200 216H56V40h80v56a8 8 0 0 0 8 8h56ZM112 144v32a8 8 0 0 1-16 0v-8H88v8a8 8 0 0 1-16 0v-32a16 16 0 0 1 16-16h8a16 16 0 0 1 16 16Zm-16 8v-8h-8v8Zm56-16h-12a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8h12a20 20 0 0 0 20-20v-8a20 20 0 0 0-20-20Zm4 28a4 4 0 0 1-4 4h-4v-16h4a4 4 0 0 1 4 4Zm44-20a8 8 0 0 1-8 8h-8v8h4a8 8 0 0 1 0 16h-4v8a8 8 0 0 1-16 0v-32a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8Z' />
      </svg>
    </span>
  );
};
