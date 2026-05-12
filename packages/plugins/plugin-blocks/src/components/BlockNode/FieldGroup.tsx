//
// Copyright 2025 DXOS.org
//

import * as Option from 'effect/Option';
import * as SchemaAST from 'effect/SchemaAST';
import React, { useMemo, useState } from 'react';

import { Annotation, Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { getDisplayLabel } from '../labels';

import { EnumBlockPicker } from './EnumBlockPicker';

// PropertyMeta annotation id — inlined to avoid pulling
// `@dxos/echo/internal` into this module.
const PropertyMetaAnnotationId = Symbol.for('@dxos/schema/annotation/PropertyMeta');

// F-6 Phase 2: render one field group per supertag of a Block. Each
// group lists the schema-derived fields of the linked typed instance
// (Task, Person, Organization) with inline editors. Field values live
// on the linked instance — editing a field calls Obj.update on it, NOT
// on the Block itself.
//
// Renders nothing when the Block has no supertags.
export type FieldGroupsProps = {
  block: any;
};

export const FieldGroups = ({ block }: FieldGroupsProps) => {
  const supertags = ((block?.supertags ?? []) as readonly any[]).filter((ref) => ref?.target);
  if (supertags.length === 0) {
    return null;
  }
  return (
    <>
      {supertags.map((ref) => {
        const instance = ref.target as any;
        return <FieldGroup key={instance.id} instance={instance} />;
      })}
    </>
  );
};

const FieldGroup = ({ instance }: { instance: any }) => {
  const [snapshot] = useObject(instance);
  const schema = Obj.getSchema(snapshot) as any;
  const typename = Obj.getTypename(snapshot) ?? 'unknown';
  // F-6.Phase3.all-echo-types: the group's display title comes
  // straight off the schema's Title annotation — no static
  // allowlist lookup. Falls back to the typename string when the
  // schema has no Title.
  const groupTitle = useMemo(() => {
    const title = (schema?.ast?.annotations as Record<symbol, unknown> | undefined)?.[Symbol.for('@effect/schema/annotation/Title')];
    return typeof title === 'string' && title.length > 0 ? title : typename;
  }, [schema, typename]);
  const fields = useMemo(() => (schema ? listFields(schema) : []), [schema]);

  if (!schema || fields.length === 0) {
    return null;
  }

  return (
    <div
      className='py-1 mb-0.5 rounded border border-dashed border-amber-200/70 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10'
      data-supertag-typename={typename}
    >
      <div className='px-2 pb-1 text-[10px] uppercase tracking-wide text-amber-700/70 dark:text-amber-400/70'>
        {groupTitle}
      </div>
      <div className='grid grid-cols-[8rem_1fr] gap-x-2 gap-y-0.5 px-2'>
        {fields.map((field) => (
          <FieldRow key={String(field.name)} instance={instance} typename={typename} field={field} />
        ))}
      </div>
    </div>
  );
};

// One labeled field row. Label is the property's title annotation (or
// property name), value is rendered via FieldEditor.
const FieldRow = ({
  instance,
  typename,
  field,
}: {
  instance: any;
  typename: string;
  field: FieldInfo;
}) => {
  return (
    <>
      <div className='text-xs leading-6 text-neutral-500 dark:text-neutral-500 truncate' title={String(field.name)}>
        {field.title}
      </div>
      <FieldEditor instance={instance} typename={typename} field={field} />
    </>
  );
};

// Renders the appropriate input for the property kind. Refs are
// read-only (we display the target's label); arrays and sub-structs
// are deferred to a future increment.
const FieldEditor = ({
  instance,
  typename,
  field,
}: {
  instance: any;
  typename: string;
  field: FieldInfo;
}) => {
  const value = instance?.[field.name as string];

  const commit = (next: unknown) => {
    Obj.update(instance, (instance: any) => {
      instance[field.name as string] = next === '' ? undefined : next;
    });
  };

  switch (field.kind) {
    case 'string':
      return <StringInput value={value as string | undefined} onCommit={commit} />;
    case 'number':
      return <NumberInput value={value as number | undefined} onCommit={commit} />;
    case 'select':
      return (
        <EnumBlockPicker
          db={Obj.getDatabase(instance)}
          typename={typename}
          fieldName={String(field.name)}
          value={value as string | undefined}
          options={field.options ?? []}
          onCommit={commit}
        />
      );
    case 'ref':
      return <RefValue value={value} />;
    case 'array':
      return (
        <span className='text-xs leading-6 text-neutral-400 dark:text-neutral-600 italic'>
          {Array.isArray(value) ? `${value.length} item${value.length === 1 ? '' : 's'}` : '—'}
        </span>
      );
    default:
      return <span className='text-xs leading-6 text-neutral-400 dark:text-neutral-600 italic'>—</span>;
  }
};

// Local-edit buffer so the input stays in sync with the live ECHO
// value but doesn't fight the user's keystrokes mid-edit. We push the
// value upstream on blur (and on Enter).
const StringInput = ({
  value,
  onCommit,
}: {
  value: string | undefined;
  onCommit: (next: string | undefined) => void;
}) => {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const display = draft ?? value ?? '';
  return (
    <input
      type='text'
      className='text-sm leading-6 bg-transparent outline-none border-b border-transparent focus:border-amber-300/60 dark:focus:border-amber-700/60 placeholder:text-neutral-400 dark:placeholder:text-neutral-700'
      value={display}
      placeholder='—'
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== undefined && draft !== (value ?? '')) {
          onCommit(draft.length === 0 ? undefined : draft);
        }
        setDraft(undefined);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          (event.currentTarget as HTMLInputElement).blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(undefined);
          (event.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
};

const NumberInput = ({
  value,
  onCommit,
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
}) => {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const display = draft ?? (value !== undefined ? String(value) : '');
  return (
    <input
      type='number'
      className='text-sm leading-6 bg-transparent outline-none border-b border-transparent focus:border-amber-300/60 dark:focus:border-amber-700/60 placeholder:text-neutral-400 dark:placeholder:text-neutral-700 w-24'
      value={display}
      placeholder='—'
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft === undefined) {
          return;
        }
        const trimmed = draft.trim();
        if (trimmed.length === 0) {
          onCommit(undefined);
        } else {
          const parsed = Number(trimmed);
          if (!Number.isNaN(parsed)) {
            onCommit(parsed);
          }
        }
        setDraft(undefined);
      }}
    />
  );
};

const RefValue = ({ value }: { value: unknown }) => {
  const target = (value as any)?.target;
  const label = target ? getDisplayLabel(target) : undefined;
  if (!label) {
    return <span className='text-sm leading-6 text-neutral-400 dark:text-neutral-600 italic'>—</span>;
  }
  return <span className='text-sm leading-6 text-neutral-700 dark:text-neutral-300'>{label}</span>;
};

export type SelectOption = { id: string; title: string };

type FieldInfo = {
  name: PropertyKey;
  title: string;
  kind: 'string' | 'number' | 'select' | 'ref' | 'array' | 'skip';
  options?: readonly SelectOption[];
};

// Hidden fields that ECHO injects on every typed object. We never
// surface these as editable rows.
const HIDDEN_FIELDS: ReadonlySet<string> = new Set(['id']);

const unwrapOptionalAst = (property: SchemaAST.PropertySignature): SchemaAST.AST => {
  if (!property.isOptional || !SchemaAST.isUnion(property.type)) {
    return property.type;
  }
  return property.type.types[0];
};

// Walk a Schema's properties and produce field descriptors for the
// kinds we render. Anything we don't know how to handle is dropped.
const listFields = (schema: any): FieldInfo[] => {
  const properties = SchemaAST.getPropertySignatures(schema.ast);
  const fields: FieldInfo[] = [];
  for (const property of properties) {
    const name = property.name;
    if (typeof name === 'string' && HIDDEN_FIELDS.has(name)) {
      continue;
    }
    const typeAst = unwrapOptionalAst(property);
    const title = readTitle(property, typeAst) ?? String(name);
    const field = classify(name, title, typeAst);
    if (field.kind !== 'skip') {
      fields.push(field);
    }
  }
  return fields;
};

const readTitle = (property: SchemaAST.PropertySignature, typeAst: SchemaAST.AST): string | undefined => {
  const fromProperty = SchemaAST.getTitleAnnotation({ annotations: property.annotations } as any);
  const propertyTitle = Option.getOrUndefined(fromProperty);
  if (propertyTitle) {
    return propertyTitle;
  }
  const fromType = SchemaAST.getTitleAnnotation(typeAst);
  return Option.getOrUndefined(fromType);
};

const classify = (name: PropertyKey, title: string, ast: SchemaAST.AST): FieldInfo => {
  // Refs are TypeLiterals carrying a ReferenceAnnotation.
  const ref = Annotation.ReferenceAnnotation.getFromAst(ast);
  if (Option.isSome(ref)) {
    return { name, title, kind: 'ref' };
  }

  // Single-select unions: detect explicit singleSelect PropertyMeta or
  // fall back to a Union whose members are all Literals.
  const selectOptions = readSingleSelectOptions(ast);
  if (selectOptions && selectOptions.length > 0) {
    return { name, title, kind: 'select', options: selectOptions };
  }

  // Refinements (Format.URL, Format.Email, etc.) — peel one layer.
  if (isRefinement(ast)) {
    return classify(name, title, ast.from);
  }
  // Transformations (Format.GeoPoint encoded form, etc.) — peel to the
  // encoded form so we treat them as strings/numbers.
  if (isTransformation(ast)) {
    return classify(name, title, ast.from);
  }

  switch (ast._tag) {
    case 'StringKeyword':
      return { name, title, kind: 'string' };
    case 'NumberKeyword':
      return { name, title, kind: 'number' };
    case 'TupleType':
      return { name, title, kind: 'array' };
    default:
      return { name, title, kind: 'skip' };
  }
};

const readSingleSelectOptions = (ast: SchemaAST.AST): SelectOption[] | undefined => {
  const meta = (ast.annotations as any)?.[PropertyMetaAnnotationId];
  const fromMeta = meta?.singleSelect?.options as Array<{ id: string; title?: string }> | undefined;
  if (fromMeta && Array.isArray(fromMeta)) {
    return fromMeta.map((option) => ({ id: option.id, title: option.title ?? option.id }));
  }
  // Fallback: a plain Schema.Literal('a','b','c') union with no PropertyMeta.
  if (isLiteralUnion(ast)) {
    return ast.types
      .filter((member: any) => member._tag === 'Literal')
      .map((member: any) => {
        const literal = member.literal;
        const literalStr = typeof literal === 'string' ? literal : String(literal);
        return { id: literalStr, title: literalStr };
      });
  }
  return undefined;
};

const isLiteralUnion = (ast: SchemaAST.AST): ast is SchemaAST.Union =>
  ast._tag === 'Union' && (ast as SchemaAST.Union).types.every((member) => (member as any)._tag === 'Literal');

const isRefinement = (ast: SchemaAST.AST): ast is SchemaAST.Refinement => ast._tag === 'Refinement';

const isTransformation = (ast: SchemaAST.AST): ast is SchemaAST.Transformation => ast._tag === 'Transformation';
