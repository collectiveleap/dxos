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
  #navigateToObject?: NavigateToObject;
  #unsubscribe?: () => void;

  constructor(
    node: Node,
    _view: EditorView,
    _getPos: () => number | undefined,
    resolveRef: ResolveRef,
    navigateToObject?: NavigateToObject,
  ) {
    this.#dxn = (node.attrs.dxn as string) ?? '';
    this.#resolveRef = resolveRef;
    this.#navigateToObject = navigateToObject;
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
    // F-PDF-Upload.chip-rendering: label = wrapper's content
    // (user-renameable) when non-empty, else the file's name.
    const fromTarget = getDisplayLabel(target).trim();
    const label = fromTarget.length > 0 ? fromTarget : getFileLabel(file);

    // Swap the span to chip styling — same visual treatment as the
    // standalone <PdfChip /> React component.
    this.dom.className =
      'inline-flex items-baseline gap-1 shrink-0 text-xs leading-none px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 no-underline align-baseline';
    this.dom.setAttribute('data-bramble-pdf-chip', '');
    this.dom.setAttribute('title', label);

    // Build the icon + label DOM. Mirrors the JSX in PdfChip.tsx so
    // visual parity is automatic.
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', '12');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 256 256');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'self-center');
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute(
      'd',
      'M213.66 82.34l-56-56A8 8 0 0 0 152 24H56a16 16 0 0 0-16 16v176a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V88a8 8 0 0 0-2.34-5.66ZM152 40l48 48h-48ZM200 216H56V40h80v56a8 8 0 0 0 8 8h56ZM112 144v32a8 8 0 0 1-16 0v-8H88v8a8 8 0 0 1-16 0v-32a16 16 0 0 1 16-16h8a16 16 0 0 1 16 16Zm-16 8v-8h-8v8Zm56-16h-12a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8h12a20 20 0 0 0 20-20v-8a20 20 0 0 0-20-20Zm4 28a4 4 0 0 1-4 4h-4v-16h4a4 4 0 0 1 4 4Zm44-20a8 8 0 0 1-8 8h-8v8h4a8 8 0 0 1 0 16h-4v8a8 8 0 0 1-16 0v-32a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8Z',
    );
    svg.appendChild(path);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'truncate max-w-[16rem]';
    labelSpan.textContent = label;

    this.dom.replaceChildren(svg, labelSpan);

    // Chip click navigates to the wrapped Wnfs.File per
    // F-PDF-Upload.chip-rendering. preventDefault keeps ProseMirror
    // from treating it as a selection change.
    this.dom.onclick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.#navigateToObject?.(file);
    };
  }
}
