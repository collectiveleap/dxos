//
// Copyright 2025 DXOS.org
//

import { Schema } from 'prosemirror-model';

// Increment 2 schema: a single paragraph holding plain text.
// Marks (bold/italic/highlight) and inline ref nodes are added in later increments
// — the StructuredContent slot in Block.ts already supports them at the data layer.

export const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph' },
    paragraph: {
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: {},
  },
});
