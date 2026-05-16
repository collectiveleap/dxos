//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload.chip-rendering: a small chip rendered adjacent to a
// bullet whose Bramble.Node wraps a PDF Wnfs.File via the F-Supertag
// pattern. Shows a `ph--file-pdf--regular` icon + a label; clicking
// opens the wrapped Wnfs.File in a new pane via Composer's standard
// navigate-to-object pathway (which routes to plugin-wnfs's
// `FileContainer` for inline PDF preview).

import React, { useMemo } from 'react';

import { getDisplayLabel } from '../labels';
import { useOpenPane } from '../backlinks';
import { getFileLabel } from './pdf-upload';

import { Bramble } from '#types';

export type PdfChipProps = {
  // The wrapper Bramble.Node — its `content` provides the user-
  // renameable label per F-PDF-Upload.editable-label-preserves-
  // attachment.
  node: Bramble.Node;
  // The Wnfs.File that `node` wraps via a supertag Ref. Carries the
  // canonical filename / mime / cid; treated as opaque (typed as
  // `any`) to avoid a compile-time dependency on `@dxos/plugin-wnfs`.
  wnfsFile: any;
};

export const PdfChip = ({ node, wnfsFile }: PdfChipProps) => {
  // F-PDF-Upload.editable-label-preserves-attachment: prefer the
  // user-edited bullet content, fall back to the file's canonical
  // name (so renaming the bullet retitles the chip, but a freshly-
  // dropped bullet with empty content still reads as "report.pdf").
  const label = useMemo(() => {
    const fromNode = node ? getDisplayLabel(node).trim() : '';
    return fromNode.length > 0 ? fromNode : getFileLabel(wnfsFile);
  }, [node, wnfsFile]);

  const openPane = useOpenPane();

  // F-PDF-Upload.chip-rendering: chip click navigates to the wrapped
  // Wnfs.File in a pane (Composer's standard openPane pathway, which
  // resolves the typename and dispatches to plugin-wnfs's registered
  // surface — `FileContainer` renders the inline PDF preview).
  // `stopPropagation` keeps the click off the bullet's zoom handler
  // so a chip click never zooms within the Bramble outline.
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!wnfsFile) {
      return;
    }
    // OpenPaneContext is typed `(node: Bramble.Node) => void`
    // conservatively, but `handleOpenPane` in Article.tsx derives the
    // qualified path via `getObjectPathFromObject`, which is
    // typename-aware and works for any ECHO object. Cast to satisfy
    // the typed boundary.
    openPane(wnfsFile as Bramble.Node);
  };

  return (
    <button
      type='button'
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
    </button>
  );
};
