//
// Copyright 2025 DXOS.org
//

import { Obj } from '@dxos/echo';

import { Bramble } from '#types';

// Label resolver shared by the mention picker, RefNodeView, and the
// graph's H1 → name auto-sync. For Bramble.Node objects, expands inline ref
// segments by recursively resolving each ref's target via this same
// function so the rendered label includes ref text — without this, a
// bullet whose content is `"hello [@A] world"` would render as
// `"hello  world"` (gaps where the refs were).
//
// Recursion is guarded with a `visited` set so that ref cycles
// (`A → B → A`) terminate with a `…` placeholder rather than looping.
export const getDisplayLabel = (object: any, visited: Set<string> = new Set()): string => {
  const stdLabel = Obj.getLabel(object);
  if (typeof stdLabel === 'string' && stdLabel.length > 0) {
    return stdLabel;
  }

  if (Obj.getTypename(object) === Bramble.Node.typename) {
    const id = object?.id as string | undefined;
    if (id && visited.has(id)) {
      return '…';
    }
    if (id) {
      visited.add(id);
    }
    const segments = (object?.content ?? []) as readonly any[];
    const text = segments
      .map((segment) => {
        if (segment?.kind === 'text') {
          return segment.text ?? '';
        }
        if (segment?.kind === 'ref') {
          const target = segment.target?.target;
          return target ? getDisplayLabel(target, visited) : '';
        }
        return '';
      })
      .join('')
      .trim();
    if (text.length > 0) {
      return text;
    }
  }

  return object?.name ?? object?.title ?? '';
};
