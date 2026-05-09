//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { Filter, Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { getDisplayLabel } from '../labels';

import { Block, type BlockOutline } from '#types';

export type BacklinksPanelProps = {
  outline: BlockOutline.BlockOutline;
};

type Backlink = {
  sourceId: string;
  sourceLabel: string;
  targetId: string;
  targetLabel: string;
};

// F-5: scans the database for Blocks whose content references any Block in
// this outline's tree (or the outline's root itself). Self-references — a
// bullet inside this outline pointing at another bullet inside it — are
// excluded so the panel only shows things linking IN from elsewhere.
//
// Strategy: manual scan of all Blocks in the database. ECHO's
// `referencedBy` introspects typed Ref fields, but our refs live inside
// StructuredContent union segments — outside that surface — so the scan
// reads each Block's content array directly. Performance: O(N blocks); a
// typed `Block.references` sidecar can replace this in a later increment.
export const BacklinksPanel = ({ outline }: BacklinksPanelProps) => {
  const [snapshot] = useObject(outline);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  useEffect(() => {
    const db = Obj.getDatabase(outline);
    if (!db) {
      return;
    }
    let cancelled = false;

    void (async () => {
      const innerIds = new Set<string>();
      const collectIds = (block: any): void => {
        if (!block || innerIds.has(block.id)) {
          return;
        }
        innerIds.add(block.id);
        const childRefs = (block.children ?? []) as readonly any[];
        for (const ref of childRefs) {
          collectIds(ref?.target);
        }
      };
      const root = (snapshot as any)?.root?.target;
      if (root) {
        collectIds(root);
      }

      const allBlocks = (await db.query(Filter.typename(Block.Block.typename)).run()) ?? [];
      const found: Backlink[] = [];
      for (const block of allBlocks) {
        if (innerIds.has((block as any).id)) {
          continue;
        }
        const content = ((block as any).content ?? []) as readonly any[];
        if (!Array.isArray(content)) {
          continue;
        }
        for (const segment of content) {
          if (segment?.kind !== 'ref') {
            continue;
          }
          const target = segment.target?.target;
          if (target && innerIds.has((target as any).id)) {
            found.push({
              sourceId: (block as any).id,
              sourceLabel: getDisplayLabel(block) || '(unnamed bullet)',
              targetId: (target as any).id,
              targetLabel: getDisplayLabel(target) || '(unnamed bullet)',
            });
            break;
          }
        }
      }
      if (!cancelled) {
        setBacklinks(found);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [outline, snapshot]);

  if (backlinks.length === 0) {
    return null;
  }

  return (
    <div className='mt-8 border-t border-neutral-200 dark:border-neutral-800 pt-4'>
      <h3 className='text-sm font-semibold opacity-60 mb-2'>
        Linked references ({backlinks.length})
      </h3>
      <ul className='space-y-1'>
        {backlinks.map((backlink, index) => (
          <li key={`${backlink.sourceId}-${index}`} className='text-sm flex gap-2 items-baseline'>
            <span className='opacity-60 truncate' title={backlink.sourceLabel}>
              {backlink.sourceLabel}
            </span>
            <span className='opacity-30 shrink-0'>→</span>
            <span className='truncate' title={backlink.targetLabel}>
              {backlink.targetLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
