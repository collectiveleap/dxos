//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useObject } from '@dxos/react-client/echo';

import { listOptionBlocks, optionLabelOf, useOptionBlock, type OptionKey } from './tag-options';

import { Block } from '#types';

// F-6 Phase 2: enum-field editor that materializes each declared
// literal as a Block (per `rule R-No-Echo-Changes`). The currently
// selected literal is rendered as an inline ref-pill whose label is
// the option Block's `content` — so renames propagate live across
// every typed instance that references this literal in the space.
//
// Clicking the pill opens a picker listing the schema-declared
// literals; each row shows the matching option Block's label (or the
// schema title as fallback for literals not yet materialized).
// Selecting a row writes the literal string to the typed instance.

export type SelectOption = { id: string; title: string };

export type EnumBlockPickerProps = {
  db: any;
  typename: string;
  fieldName: string;
  value: string | undefined;
  options: readonly SelectOption[];
  onCommit: (next: string | undefined) => void;
};

export const EnumBlockPicker = ({
  db,
  typename,
  fieldName,
  value,
  options,
  onCommit,
}: EnumBlockPickerProps) => {
  // Schema title for the currently-selected literal (used as the
  // initial content of the option Block when we create it on first
  // encounter).
  const schemaTitleForValue = useMemo(
    () => (value !== undefined ? options.find((option) => option.id === value)?.title : undefined),
    [value, options],
  );

  // Hook is called unconditionally; key is null when value is unset
  // so no materialization happens.
  const optionKey = useMemo<OptionKey | null>(
    () => (value !== undefined ? { typename, fieldName, literal: value } : null),
    [typename, fieldName, value],
  );
  const optionBlock = useOptionBlock(db, optionKey, schemaTitleForValue);

  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Pill optionBlock={optionBlock} schemaTitle={schemaTitleForValue} onClick={() => setOpen(true)} />
    );
  }

  return (
    <Picker
      db={db}
      typename={typename}
      fieldName={fieldName}
      options={options}
      currentValue={value}
      onSelect={(next) => {
        onCommit(next);
        setOpen(false);
      }}
      onClose={() => setOpen(false)}
    />
  );
};

// The collapsed-state display. Shows the option Block's live content
// when present, the schema title as fallback during create, or "—"
// when nothing is selected.
const Pill = ({
  optionBlock,
  schemaTitle,
  onClick,
}: {
  optionBlock: Block.Block | undefined;
  schemaTitle: string | undefined;
  onClick: () => void;
}) => {
  // Subscribe to the option Block so rename propagates live. When the
  // Block is undefined (unset value), useObject still handles it
  // gracefully.
  const [snapshot] = useObject(optionBlock as any);
  const label = optionLabelOf(snapshot as any) ?? schemaTitle;

  if (!label) {
    return (
      <button
        type='button'
        className='text-sm leading-6 text-neutral-400 dark:text-neutral-600 italic cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-400'
        onClick={onClick}
        aria-label='Select value'
      >
        —
      </button>
    );
  }

  return (
    <button
      type='button'
      className='inline-flex items-baseline gap-0.5 text-sm leading-6 px-1.5 py-0 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 self-start'
      onClick={onClick}
      title={`Click to change`}
    >
      {label}
    </button>
  );
};

// Picker dropdown. Lists the schema-declared literals; each row shows
// the option Block's label when materialized, the schema title
// otherwise. Selecting a row commits the literal to the typed
// instance and closes the picker. Clicking outside dismisses without
// selecting; Esc also dismisses.
const Picker = ({
  db,
  typename,
  fieldName,
  options,
  currentValue,
  onSelect,
  onClose,
}: {
  db: any;
  typename: string;
  fieldName: string;
  options: readonly SelectOption[];
  currentValue: string | undefined;
  onSelect: (next: string | undefined) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Snapshot of materialized option Blocks for this (typename,
  // fieldName). Used to surface user-renamed labels in the picker
  // alongside any schema literals that haven't been materialized.
  const optionBlocks = useMemo(() => listOptionBlocks(db, typename, fieldName), [db, typename, fieldName]);

  // Close on outside click and on Esc. The mousedown timing matches
  // the MentionPicker/TagPicker pattern so the editor's focus isn't
  // stolen mid-pick.
  useEffect(() => {
    const handleDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className='relative inline-block self-start'>
      <div className='absolute z-50 mt-1 min-w-40 max-w-72 rounded border bg-white dark:bg-neutral-900 shadow-lg'>
        <ul className='max-h-64 overflow-y-auto'>
          <li>
            <button
              type='button'
              className='flex w-full items-center gap-2 px-3 py-1 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500'
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(undefined);
              }}
            >
              —
            </button>
          </li>
          {options.map((option) => {
            const materialized = optionBlocks.find((block) => (block as any).tagOption?.literal === option.id);
            const label = optionLabelOf(materialized) ?? option.title;
            return (
              <li key={option.id}>
                <button
                  type='button'
                  className={
                    'flex w-full items-center gap-2 px-3 py-1 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ' +
                    (option.id === currentValue ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : '')
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(option.id);
                  }}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
