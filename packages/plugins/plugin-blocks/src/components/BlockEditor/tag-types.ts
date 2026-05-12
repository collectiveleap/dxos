//
// Copyright 2025 DXOS.org
//

import * as Option from 'effect/Option';
import type * as Schema from 'effect/Schema';
import * as SchemaAST from 'effect/SchemaAST';
import { useMemo } from 'react';

import { Annotation, Type } from '@dxos/echo';
import { EntityKind, SystemTypeAnnotation, getTypeAnnotation } from '@dxos/echo/internal';

// F-6.Phase3.all-echo-types: every non-Relation, non-System ECHO
// schema registered with the database can be applied as a
// supertag. There is NO hardcoded allowlist — the # picker, the
// rendered TagChip, and the FieldGroup header all resolve their
// schema from `db.schemaRegistry` by typename at render time so
// new types appear the moment they're registered.
export type TagTypeEntry = {
  schema: Schema.Schema.Any;
  typename: string;
  // Display title for the picker entry and the rendered chip.
  // Falls back to the bare typename if the schema has no title.
  title: string;
  // Optional Phosphor icon name (`ph--*--regular`) for the picker row.
  icon?: string;
};

// Resolve the human-readable schema title via the official Effect
// `SchemaAST.getTitleAnnotation` accessor, falling back to the
// last segment of the typename (capitalised) when no Title is set
// — `org.dxos.type.person` → `Person` — and finally to the bare
// fallback (the full typename) when there's no parseable typename.
const titleOf = (schema: Schema.Schema.Any, fallback: string): string => {
  const annotated = Option.getOrUndefined(SchemaAST.getTitleAnnotation(schema.ast));
  if (typeof annotated === 'string' && annotated.length > 0) {
    return annotated;
  }
  const lastSegment = fallback.split('.').pop() ?? fallback;
  if (lastSegment.length > 0 && lastSegment !== fallback) {
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  }
  return fallback;
};

const iconOf = (schema: Schema.Schema.Any): string | undefined => {
  const icon = Annotation.IconAnnotation.get(schema as any);
  // Effect Option .pipe is heavy; just unwrap defensively.
  const value = (icon as any)?._tag === 'Some' ? (icon as any).value : undefined;
  return value?.icon;
};

// Build a minimal valid props object for a tag-ready schema by
// providing empty defaults for any non-optional fields. Required for
// schemas like `Task` whose `title` field is non-optional — without a
// default `Obj.make` throws a ParseError. Skips the auto-injected
// `id` property (ECHO supplies it during the make call).
//
// Optional fields are intentionally NOT pre-seeded: `Obj.make` filters
// out undefined values from props before constructing the proxy
// target, so seeding with `undefined` would be a no-op. Setting a
// previously-unset optional field is supported by Obj.update directly
// because the proxy's target is plain and extensible — earlier reports
// to the contrary were a snapshot-vs-live confusion.
export const initialPropsForTag = (schema: Schema.Schema.Any): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  for (const property of SchemaAST.getPropertySignatures(schema.ast)) {
    if (property.isOptional) {
      continue;
    }
    const name = typeof property.name === 'string' ? property.name : String(property.name);
    if (name === 'id') {
      continue;
    }
    const type = property.type as SchemaAST.AST;
    if (type._tag === 'StringKeyword') {
      defaults[name] = '';
    }
    // Other required kinds get no default; if a future seed schema
    // requires a non-string field, add a branch here.
  }
  return defaults;
};

// Convert a Schema into a `TagTypeEntry`. Pulls the typename, title
// annotation (with the typename string as a fallback), and any icon
// annotation off the Schema's AST. Shared by `useTagTypes` and the
// per-typename lookup helpers below.
// `schema` is typed as `any` because the schemaRegistry returns a
// runtime-validated array whose element type
// (`Schema.Schema.Any`, context: unknown) doesn't conform to the
// stricter `AnyEntity` signature `Type.getTypename` expects. The
// pattern matches `MentionPicker`'s consumption of the registry.
const entryFromSchema = (schema: any): TagTypeEntry | undefined => {
  const typename = Type.getTypename(schema);
  if (!typename) {
    return undefined;
  }
  return {
    schema,
    typename,
    title: titleOf(schema, typename),
    icon: iconOf(schema),
  };
};

// F-6.Phase3.all-echo-types: filter every schema in the space's
// registry down to the ones that should appear as supertag options.
// Same filter as `MentionPicker` (which surfaces every Block + typed
// instance in the space):
//
// - Exclude Relations: they're edges, not nodes — you can't "be" a
//   relation. ChildEdge falls out here too.
// - Exclude System types: these are scaffolding (e.g. Identity,
//   Space, etc.) that shouldn't surface in a user-facing picker.
//
// Plugin-internal Block / BlockOutline schemas DO appear in the
// list (they don't carry SystemTypeAnnotation today); the user can
// pick them if they want to attach Block/Outline schema to a bullet.
const collectTagTypes = (db: any): TagTypeEntry[] => {
  if (!db?.schemaRegistry?.query) {
    return [];
  }
  const schemas: any[] = db.schemaRegistry.query({ location: ['database', 'runtime'] }).runSync() ?? [];
  const entries: TagTypeEntry[] = [];
  for (const schema of schemas) {
    if (getTypeAnnotation(schema)?.kind === EntityKind.Relation) {
      continue;
    }
    if (SystemTypeAnnotation.get(schema).pipe(Option.getOrElse(() => false))) {
      continue;
    }
    const entry = entryFromSchema(schema);
    if (entry) {
      entries.push(entry);
    }
  }
  entries.sort((a, b) => a.title.localeCompare(b.title));
  return entries;
};

// React hook: returns the live list of tag-ready ECHO types for the
// given database. Caller is the # picker; recomputation only fires
// when `db` changes — re-mounting the picker is cheap, so a static
// snapshot at open time is fine for v1. Schema additions during the
// picker's life are picked up the next time the user opens it.
export const useTagTypes = (db: any): readonly TagTypeEntry[] => {
  return useMemo(() => collectTagTypes(db), [db]);
};

// Synchronous lookup: get the `TagTypeEntry` for a given typename
// from the space's schema registry, or `undefined` if the schema
// isn't registered (e.g. an outline imported from another space
// whose schema hasn't been replicated yet). Used by `TagChip` and
// `FieldGroup` to resolve their per-typename display titles
// dynamically instead of through a static map.
export const findTagTypeByTypename = (db: any, typename: string | undefined): TagTypeEntry | undefined => {
  if (!db?.schemaRegistry?.query || !typename) {
    return undefined;
  }
  const schemas = db.schemaRegistry.query({ location: ['database', 'runtime'] }).runSync() ?? [];
  for (const schema of schemas) {
    if (Type.getTypename(schema) === typename) {
      return entryFromSchema(schema);
    }
  }
  return undefined;
};
