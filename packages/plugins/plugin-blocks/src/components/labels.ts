//
// Copyright 2025 DXOS.org
//

import { Obj } from '@dxos/echo';

import { Block } from '#types';

// Label resolver shared by the mention picker and the RefNodeView. Falls back
// to the Block's text content when an object has no canonical label — without
// this, individual bullets render as "block/<id>" placeholders even though
// they're addressable graph nodes.
export const getDisplayLabel = (object: any): string => {
  const stdLabel = Obj.getLabel(object);
  if (typeof stdLabel === 'string' && stdLabel.length > 0) {
    return stdLabel;
  }

  if (Obj.getTypename(object) === Block.Block.typename) {
    const segments = (object?.content ?? []) as readonly any[];
    const text = segments
      .filter((segment) => segment?.kind === 'text')
      .map((segment) => segment.text ?? '')
      .join('')
      .trim();
    if (text.length > 0) {
      return text;
    }
  }

  return object?.name ?? object?.title ?? '';
};
