//
// Copyright 2025 DXOS.org
//

import { type Node } from 'prosemirror-model';
import { type EditorView } from 'prosemirror-view';

import { Obj } from '@dxos/echo';

import { getDisplayLabel } from '../labels';
import { findFileSupertag, getFileLabel, isPdfFile } from '../PdfDrop/pdf-upload';

export type ResolveRef = (dxn: string) => any;

// Called when the user activates a ref whose target is a navigable
// foreign-typename object (e.g. a Wnfs.File). The Editor wires this
// through to `useOpenPane`. Optional — when omitted, ref activation
// is a no-op for cross-typename targets.
export type NavigateToObject = (target: any) => void;

// Increment 4b: vanilla NodeView for the inline ref node. Resolves the target
// at mount, subscribes to it via Obj.subscribe so a rename of the target
// propagates to the rendered label without any local edit.
//
// 2026-05-16: when the target is a Bramble.Node wrapping a PDF
// Wnfs.File (per F-PDF-Upload's supertag pattern), render the PDF
// chip surface inline instead of the plain text label, so an
// @-mention to a PDF Node shows the same chip as the source bullet
// (T-PDF-Mention-renders-attachment).
export class RefNodeView {
  readonly dom: HTMLElement;
  #dxn: string;
  #resolveRef: ResolveRef;
  #unsubscribe?: () => void;

  constructor(
    node: Node,
    _view: EditorView,
    _getPos: () => number | undefined,
    resolveRef: ResolveRef,
    // F-PDF-Upload.chip-rendering (revised 2026-05-16): the PDF
    // icon is no longer interactive; this parameter is retained
    // for API stability but currently unused. Re-enable if a
    // future feat needs cross-typename navigation from an inline
    // ref again.
    _navigateToObject?: NavigateToObject,
  ) {
    this.#dxn = (node.attrs.dxn as string) ?? '';
    this.#resolveRef = resolveRef;
    this.dom = document.createElement('span');
    // F-V3 styling: link-blue, no underline by default, underline on hover.
    // The PDF-chip branch in #renderChip swaps this className for a
    // chip-shaped surface; #renderLabel restores it for the plain
    // text label branch.
    this.dom.className =
      'block-ref text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';
    this.dom.setAttribute('data-dxn', this.#dxn);
    this.#bind();
  }

  update(node: Node): boolean {
    if (node.type.name !== 'ref') {
      return false;
    }
    const nextDxn = (node.attrs.dxn as string) ?? '';
    if (nextDxn !== this.#dxn) {
      this.#dxn = nextDxn;
      this.dom.setAttribute('data-dxn', this.#dxn);
      this.#bind();
    } else {
      this.#render();
    }
    return true;
  }

  destroy(): void {
    this.#unsubscribe?.();
  }

  // (Re)resolve the target and subscribe so external mutations to its fields
  // (notably rename via Obj.update) propagate into the rendered label.
  #bind(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#render();
    const target = this.#dxn ? this.#resolveRef(this.#dxn) : undefined;
    if (target) {
      // Subscribe to the wrapper. For PDF wrappers we also need to
      // re-render when the WRAPPED file's name changes; in practice
      // file renames are rare today (the wrapper's content carries
      // the user-edited label), so subscribing only to the wrapper
      // is sufficient for F-4b live-rename propagation. If file-side
      // renames need to propagate later, add an Obj.subscribe on the
      // wrapped Wnfs.File too.
      this.#unsubscribe = Obj.subscribe(target, () => this.#render());
    }
  }

  #render(): void {
    const target = this.#dxn ? this.#resolveRef(this.#dxn) : undefined;
    if (!target) {
      this.#renderLabel('…');
      return;
    }
    // F-PDF-Upload: when the ref target wraps a PDF Wnfs.File, render
    // the chip surface inline. T-PDF-Mention-renders-attachment.
    const file = findFileSupertag(target);
    if (file && isPdfFile(file)) {
      this.#renderChip(target, file);
      return;
    }
    const label = getDisplayLabel(target);
    this.#renderLabel(label || '…');
  }

  #renderLabel(text: string): void {
    // Restore plain-ref styling (overrides any chip styling left from
    // a previous render of the same NodeView).
    this.dom.className =
      'block-ref text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';
    this.dom.replaceChildren(document.createTextNode(text));
    // Remove chip click handler if previously attached.
    this.dom.onclick = null;
  }

  #renderChip(target: any, file: any): void {
    // F-PDF-Upload.chip-rendering + T-PDF-Mention-renders-
    // attachment: an inline ref to a PDF-wrapping Node renders
    // the wrapper's content text (the filename per
    // F-PDF-Upload.drop-seeds-content-with-filename) followed by
    // a non-interactive PDF icon. The inline-ref TEXT remains an
    // active link to the target (per F-4 standard inline-ref
    // behavior); the icon is purely visual.
    const fromTarget = getDisplayLabel(target).trim();
    const label = fromTarget.length > 0 ? fromTarget : getFileLabel(file);

    // Standard inline-ref styling on the outer span (matches
    // #renderLabel) — the label text is the navigable link.
    this.dom.className =
      'block-ref text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';
    this.dom.removeAttribute('data-bramble-pdf-chip');
    this.dom.removeAttribute('title');

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    // Non-interactive PDF icon, styled identically to <PdfChip />.
    const iconSpan = document.createElement('span');
    iconSpan.className =
      'inline-flex items-center shrink-0 ml-1 text-rose-600 dark:text-rose-400 align-baseline';
    iconSpan.setAttribute('aria-label', 'PDF');
    iconSpan.setAttribute('title', getFileLabel(file));
    iconSpan.setAttribute('data-bramble-pdf-chip', '');
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', '12');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 256 256');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute(
      'd',
      'M213.66 82.34l-56-56A8 8 0 0 0 152 24H56a16 16 0 0 0-16 16v176a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V88a8 8 0 0 0-2.34-5.66ZM152 40l48 48h-48ZM200 216H56V40h80v56a8 8 0 0 0 8 8h56ZM112 144v32a8 8 0 0 1-16 0v-8H88v8a8 8 0 0 1-16 0v-32a16 16 0 0 1 16-16h8a16 16 0 0 1 16 16Zm-16 8v-8h-8v8Zm56-16h-12a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8h12a20 20 0 0 0 20-20v-8a20 20 0 0 0-20-20Zm4 28a4 4 0 0 1-4 4h-4v-16h4a4 4 0 0 1 4 4Zm44-20a8 8 0 0 1-8 8h-8v8h4a8 8 0 0 1 0 16h-4v8a8 8 0 0 1-16 0v-32a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8Z',
    );
    svg.appendChild(path);
    iconSpan.appendChild(svg);

    this.dom.replaceChildren(labelSpan, iconSpan);
    // Per F-PDF-Upload.chip-rendering: the icon is non-interactive.
    // The OUTER span still navigates (inline-ref link), but no
    // dedicated chip-click handler.
    this.dom.onclick = null;
  }
}
