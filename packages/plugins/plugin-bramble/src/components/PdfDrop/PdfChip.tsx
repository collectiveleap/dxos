//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload.chip-rendering: a small chip rendered adjacent to a
// bullet's editor content when the Node's attachment is a PDF. Shows
// a `ph--file-pdf--regular` icon + the filename; clicking opens the
// URL in a new tab.

import React, { useMemo } from 'react';

import { getAttachmentLabel } from './pdf-upload';

import { Bramble } from '#types';

export type PdfChipProps = {
  // The live Node's attachment payload — see `Bramble.Node.attachment`.
  attachment: NonNullable<Bramble.Node['attachment']>;
};

export const PdfChip = ({ attachment }: PdfChipProps) => {
  const label = useMemo(() => getAttachmentLabel(attachment), [attachment]);

  // F-PDF-Upload.chip-rendering: clicking opens the URL in a new tab
  // (target=_blank, rel=noopener noreferrer). `stopPropagation` keeps
  // the click off the bullet's zoom handler so a chip click never
  // navigates the pane.
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  return (
    <a
      href={attachment.url}
      target='_blank'
      rel='noopener noreferrer'
      onClick={handleClick}
      className='inline-flex items-baseline gap-1 shrink-0 text-xs leading-none px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 no-underline'
      title={label}
      data-bramble-pdf-chip
    >
      <svg
        width='12'
        height='12'
        viewBox='0 0 256 256'
        fill='currentColor'
        aria-hidden
        className='self-center'
      >
        {/* Inlined Phosphor `ph--file-pdf--regular` glyph. Inlined
            (rather than imported from a phosphor package) so the
            chip has no new runtime dependency. */}
        <path d='M213.66 82.34l-56-56A8 8 0 0 0 152 24H56a16 16 0 0 0-16 16v176a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V88a8 8 0 0 0-2.34-5.66ZM152 40l48 48h-48ZM200 216H56V40h80v56a8 8 0 0 0 8 8h56ZM112 144v32a8 8 0 0 1-16 0v-8H88v8a8 8 0 0 1-16 0v-32a16 16 0 0 1 16-16h8a16 16 0 0 1 16 16Zm-16 8v-8h-8v8Zm56-16h-12a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8h12a20 20 0 0 0 20-20v-8a20 20 0 0 0-20-20Zm4 28a4 4 0 0 1-4 4h-4v-16h4a4 4 0 0 1 4 4Zm44-20a8 8 0 0 1-8 8h-8v8h4a8 8 0 0 1 0 16h-4v8a8 8 0 0 1-16 0v-32a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8Z' />
      </svg>
      <span className='truncate max-w-[16rem]'>{label}</span>
    </a>
  );
};
