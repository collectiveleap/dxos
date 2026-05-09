//
// Copyright 2025 DXOS.org
//

import { type Node } from 'prosemirror-model';

import { schema } from './schema';

// StructuredContent shape (from Block.ts) — text spans and ref spans.
// Increment 2 only handles text; ref segments are passed through unchanged at the
// data layer until Increment 4 introduces inline-ref rendering.

// Increment 2 only emits/consumes plain text segments. The schema-level
// TextSpan supports marks, but we don't produce them yet — so the local
// type omits them to keep assignments to Block.content typecheck.
type TextSegment = { kind: 'text'; text: string };
type RefSegment = { kind: 'ref'; target: unknown };
type Segment = TextSegment | RefSegment;

// Build a ProseMirror doc from a Block's content.
export const toDoc = (content: readonly Segment[] | undefined): Node => {
  const text = (content ?? [])
    .filter((segment): segment is TextSegment => segment?.kind === 'text')
    .map((segment) => segment.text ?? '')
    .join('');

  const inline = text.length > 0 ? [schema.text(text)] : undefined;
  const paragraph = schema.nodes.paragraph.create(null, inline);
  return schema.nodes.doc.create(null, paragraph);
};

// Extract a Block's content from a ProseMirror doc.
// Returns a mutable array because Block.content (Effect Schema mutable array)
// rejects readonly assignments.
export const fromDoc = (doc: Node): TextSegment[] => {
  let text = '';
  doc.descendants((node) => {
    if (node.isText) {
      text += node.text ?? '';
    }
  });
  return text.length === 0 ? [] : [{ kind: 'text', text }];
};
