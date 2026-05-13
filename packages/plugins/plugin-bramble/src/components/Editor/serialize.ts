//
// Copyright 2025 DXOS.org
//

import { type Node } from 'prosemirror-model';

import { schema } from './schema';

// StructuredContent shape — text spans with optional marks and ref spans
// that point at any ECHO object via a typed Ref. Increment 4 only emits
// text and ref segments; marks land in a later increment.

type TextSegment = { kind: 'text'; text: string };
type RefSegment = { kind: 'ref'; target: any };
type Segment = TextSegment | RefSegment;

// Build a ProseMirror doc from a Block's content.
export const toDoc = (content: readonly Segment[] | undefined): Node => {
  const segments = content ?? [];
  const inline: Node[] = [];
  for (const seg of segments) {
    if (!seg) {
      continue;
    }
    if (seg.kind === 'text') {
      const text = (seg as TextSegment).text ?? '';
      if (text.length > 0) {
        inline.push(schema.text(text));
      }
    } else if (seg.kind === 'ref') {
      const target = (seg as RefSegment).target;
      const dxn = target?.dxn?.toString?.() ?? '';
      if (dxn) {
        inline.push(schema.nodes.ref.create({ dxn }));
      }
    }
  }
  const paragraph =
    inline.length > 0 ? schema.nodes.paragraph.create(null, inline) : schema.nodes.paragraph.create();
  return schema.nodes.doc.create(null, paragraph);
};

// Extract a Block's content from a ProseMirror doc. The caller supplies a
// `makeRef` resolver because creating a Ref by DXN string requires access to
// the database (via Ref.fromDXN(DXN.parse(...))).
export const fromDoc = (doc: Node, makeRef: (dxn: string) => any): Segment[] => {
  const segments: Segment[] = [];
  doc.descendants((node) => {
    if (node.isText) {
      segments.push({ kind: 'text', text: node.text ?? '' });
    } else if (node.type.name === 'ref') {
      const dxn = node.attrs.dxn as string;
      if (dxn) {
        segments.push({ kind: 'ref', target: makeRef(dxn) });
      }
    }
  });
  // Coalesce consecutive text segments — keeps Block.content tidy.
  const coalesced: Segment[] = [];
  for (const seg of segments) {
    const last = coalesced[coalesced.length - 1];
    if (seg.kind === 'text' && last && last.kind === 'text') {
      (last as TextSegment).text += (seg as TextSegment).text;
    } else {
      coalesced.push(seg);
    }
  }
  return coalesced;
};
