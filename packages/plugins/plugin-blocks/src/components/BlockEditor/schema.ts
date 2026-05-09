//
// Copyright 2025 DXOS.org
//

import { Schema } from 'prosemirror-model';

// Inline content: text spans plus atomic ref nodes. The ref node carries the
// target's DXN as an attribute and is rendered live via a NodeView so the
// label updates when the target is renamed.

export const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph' },
    paragraph: {
      content: '(text | ref)*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: {},
    ref: {
      inline: true,
      atom: true,
      selectable: true,
      attrs: { dxn: { default: '' } },
      toDOM: (node) => ['span', { 'data-dxn': node.attrs.dxn, class: 'block-ref' }, '…'],
      parseDOM: [
        {
          tag: 'span[data-dxn]',
          getAttrs: (element) => ({ dxn: (element as HTMLElement).getAttribute('data-dxn') ?? '' }),
        },
      ],
    },
  },
});
