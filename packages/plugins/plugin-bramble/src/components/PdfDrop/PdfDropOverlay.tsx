//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload: drop-target hook + visual overlay for the
// drop-a-PDF-to-create-a-Node flow.
//
// `usePdfDropTarget` returns a set of DragEvent handlers and a React
// element. The consumer (Article) spreads the handlers onto its main
// scroll container so the container itself becomes the drop target —
// this way the editor underneath keeps its normal pointer-events and
// the user can still click / select text freely. The returned element
// is positioned ABSOLUTELY inside the same container and is purely
// visual (pointer-events: none); it lights up the dashed drop-zone
// border while dragActive and surfaces a transient status line after
// each drop.

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useCapabilities } from '@dxos/app-framework/ui';
import { AppCapabilities } from '@dxos/app-toolkit';
import { Obj } from '@dxos/echo';

import { attachAsChild, uploadPdfWithDedup } from './pdf-upload';

import { Bramble } from '#types';

export type UsePdfDropTargetOptions = {
  // The current page node — used as the default drop-site parent when
  // the drop didn't land over a specific bullet row.
  pageNode: Bramble.Node | null;
};

export type UsePdfDropTargetResult = {
  // Spread these onto the container element you want to act as the
  // drop target. The container must establish a CSS containing block
  // (`position: relative`) so the absolutely-positioned overlay is
  // sized correctly.
  dragHandlers: {
    onDragEnter: (event: React.DragEvent) => void;
    onDragOver: (event: React.DragEvent) => void;
    onDragLeave: (event: React.DragEvent) => void;
    onDrop: (event: React.DragEvent) => void;
  };
  // Render this once inside the drop-target container — it positions
  // itself absolutely and stays invisible (`pointer-events: none`)
  // except for the transient drag-active hint + post-drop status.
  overlay: React.ReactElement;
};

// True when the drag's dataTransfer carries at least one file. Some
// browsers expose only `types` (not the actual files) during
// `dragover`, so we filter for the synthetic 'Files' type marker.
const dragHasFiles = (event: React.DragEvent): boolean => {
  const types = event.dataTransfer?.types;
  if (!types) {
    return false;
  }
  return Array.from(types).includes('Files');
};

// Pull every PDF (or PDF-like) file off the drop's dataTransfer.
const extractPdfFiles = (event: React.DragEvent): File[] => {
  const files = event.dataTransfer?.files;
  if (!files) {
    return [];
  }
  const out: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files.item(i);
    if (!file) {
      continue;
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      out.push(file);
    }
  }
  return out;
};

// Find the Bramble.Node id of the bullet row at the given screen
// coordinates by walking the DOM ancestry of `elementFromPoint`.
// Returns null when the drop landed over the page body (header, gap,
// backlinks panel, etc.) — caller falls back to the page node.
const dropSiteIdAt = (clientX: number, clientY: number): string | null => {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!el) {
    return null;
  }
  const row = el.closest('[data-block-id]') as HTMLElement | null;
  return row?.dataset?.blockId ?? null;
};

export const usePdfDropTarget = ({ pageNode }: UsePdfDropTargetOptions): UsePdfDropTargetResult => {
  const [uploader] = useCapabilities(AppCapabilities.FileUploader);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // F-PDF-Upload: `dragenter`/`dragleave` fire as the cursor crosses
  // every child element, so we keep a counter (incremented on enter,
  // decremented on leave) instead of toggling on each event. The
  // overlay is "active" while counter > 0.
  const dragDepthRef = useRef(0);

  const db = pageNode ? Obj.getDatabase(pageNode) : undefined;

  const onDragEnter = useCallback((event: React.DragEvent) => {
    if (!dragHasFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!dragHasFiles(event)) {
      return;
    }
    // preventDefault is required to make the element a valid drop target.
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    if (!dragHasFiles(event)) {
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }, []);

  // Surface a transient status string after each drop (success or
  // "no uploader available"). Auto-clears after a few seconds so the
  // overlay doesn't accumulate.
  useEffect(() => {
    if (!status) {
      return;
    }
    const timeout = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timeout);
  }, [status]);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      if (!dragHasFiles(event)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = 0;
      setDragActive(false);

      const files = extractPdfFiles(event);
      if (files.length === 0) {
        return;
      }

      // F-PDF-Upload.no-uploader-graceful: bail with a visible hint
      // when no plugin contributes the FileUploader capability.
      if (!uploader) {
        setStatus('File upload unavailable — enable the Files plugin to drop PDFs.');
        return;
      }
      if (!db || !pageNode) {
        setStatus('No database for this page — try reopening the bramble.');
        return;
      }

      // Resolve the drop-site parent. The drop event's coordinates
      // map back to a bullet row when the user released over one;
      // otherwise the page node is the parent.
      const dropSiteId = dropSiteIdAt(event.clientX, event.clientY);
      const dropSiteNode = dropSiteId
        ? (db.getObjectById?.(dropSiteId) as Bramble.Node | undefined)
        : undefined;
      const parent = dropSiteNode ?? pageNode;

      let createdCount = 0;
      let dedupedCount = 0;
      for (const file of files) {
        try {
          const result = await uploadPdfWithDedup({ db, file, uploader });
          if (!result) {
            continue;
          }
          attachAsChild(db, parent, result.node);
          if (result.deduped) {
            dedupedCount += 1;
          } else {
            createdCount += 1;
          }
        } catch (err) {
          // Last-resort: surface the failure as a visible hint. We
          // don't have plugin-bramble-local error toasts yet, so the
          // overlay status string is the user-facing surface.
          // eslint-disable-next-line no-console
          console.warn('[plugin-bramble] PDF drop failed', err);
          setStatus('PDF upload failed. See console for details.');
        }
      }

      if (createdCount > 0 && dedupedCount > 0) {
        setStatus(`Added ${createdCount} new, linked ${dedupedCount} existing.`);
      } else if (createdCount > 0) {
        setStatus(`Added ${createdCount} PDF${createdCount === 1 ? '' : 's'}.`);
      } else if (dedupedCount > 0) {
        setStatus(
          `Linked ${dedupedCount} existing PDF${dedupedCount === 1 ? '' : 's'} — same file already in this space.`,
        );
      }
    },
    [uploader, db, pageNode],
  );

  const overlay = (
    <div
      className='absolute inset-0 pointer-events-none'
      aria-hidden
      data-bramble-pdf-drop-overlay
    >
      {dragActive && (
        <div className='absolute inset-2 flex items-center justify-center rounded-md border-2 border-dashed border-indigo-500 bg-indigo-50/70 dark:border-indigo-400 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 text-sm font-medium'>
          Drop PDF to add as a bullet
        </div>
      )}
      {status && (
        <div
          className='absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-neutral-900/80 dark:bg-neutral-50/90 text-neutral-50 dark:text-neutral-900 text-xs shadow-md'
          role='status'
        >
          {status}
        </div>
      )}
    </div>
  );

  return {
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
    overlay,
  };
};
