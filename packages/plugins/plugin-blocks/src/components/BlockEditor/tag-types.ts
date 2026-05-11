//
// Copyright 2025 DXOS.org
//

import type * as Schema from 'effect/Schema';
import * as SchemaAST from 'effect/SchemaAST';

import { Annotation, Type } from '@dxos/echo';
import { Organization, Person, Task } from '@dxos/types';

// F-6 Phase 1: internal allowlist of ECHO types considered "tag-ready".
// Each entry is what the `#` picker offers as a supertag option;
// selecting one creates a fresh instance of that schema and links it
// via `Block.supertags`.
//
// This is hardcoded for now to drive UX iteration without prematurely
// committing to a user-editable allowlist UI. Add types here as we
// validate the chip + field-editing flows; remove ones that don't
// make sense as supertags.
export type TagTypeEntry = {
  schema: Schema.Schema.Any;
  typename: string;
  // Display title for the picker entry and the rendered chip.
  // Falls back to the bare typename if the schema has no title.
  title: string;
  // Optional Phosphor icon name (`ph--*--regular`) for the picker row.
  icon?: string;
};

const titleOf = (schema: Schema.Schema.Any, fallback: string): string => {
  const title = schema.ast.annotations?.[Symbol.for('@effect/schema/annotation/Title')];
  return typeof title === 'string' ? title : fallback;
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

// Note: `Task`, `Person`, and `Organization` from `@dxos/types` are
// re-exported as `import * as Foo` namespaces, so the actual Schema is
// at `Foo.Foo`.
export const TAG_TYPES: readonly TagTypeEntry[] = [
  {
    schema: Task.Task,
    typename: Type.getTypename(Task.Task) ?? 'org.dxos.type.task',
    title: titleOf(Task.Task, 'Task'),
    icon: iconOf(Task.Task),
  },
  {
    schema: Person.Person,
    typename: Type.getTypename(Person.Person) ?? 'org.dxos.type.person',
    title: titleOf(Person.Person, 'Person'),
    icon: iconOf(Person.Person),
  },
  {
    schema: Organization.Organization,
    typename: Type.getTypename(Organization.Organization) ?? 'org.dxos.type.organization',
    title: titleOf(Organization.Organization, 'Organization'),
    icon: iconOf(Organization.Organization),
  },
] as const;
