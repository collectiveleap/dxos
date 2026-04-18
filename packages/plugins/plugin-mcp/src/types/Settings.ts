//
// Copyright 2025 DXOS.org
//

import * as Schema from 'effect/Schema';

export const McpServerEntry = Schema.mutable(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    url: Schema.String,
    protocol: Schema.Union(Schema.Literal('sse'), Schema.Literal('http')),
  }),
);

export type McpServerEntry = Schema.Schema.Type<typeof McpServerEntry>;

export const Settings = Schema.mutable(
  Schema.Struct({
    servers: Schema.mutable(Schema.Array(McpServerEntry)),
  }),
);

export type Settings = Schema.Schema.Type<typeof Settings>;
