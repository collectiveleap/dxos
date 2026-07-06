//
// Copyright 2026 DXOS.org
//

import { type Atom } from '@effect-atom/atom-react';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import { Capability } from '@dxos/app-framework';
import { AppCapabilities, AppNode, AppNodeMatcher, Paths } from '@dxos/app-toolkit';
import { Filter, Obj, Type } from '@dxos/echo';
import { GraphBuilder, Node, NodeMatcher } from '@dxos/plugin-graph';
import { isSpace } from '@dxos/react-client/echo';

import { meta } from '#meta';

import {
  READWISE_HIGHLIGHTS_NODE_DATA,
  READWISE_HIGHLIGHTS_TYPE,
  READWISE_SECTION_TYPE,
  READWISE_SOURCES_NODE_DATA,
  READWISE_SOURCES_TYPE,
} from '../constants';
import { getHighlightsId, getReadwiseSectionId, getSourcesId } from '../paths';
import { Highlight, Readwise } from '../types';

const readwiseTypename = Type.getTypename(Readwise.Readwise);

/** Resolve the account carried in a Sources/Highlights folder node's properties. */
const accountOf = (node: Node.Node): Readwise.Readwise | undefined =>
  Readwise.instanceOf(node.properties.account) ? node.properties.account : undefined;

/** Highlights whose `container` ref points at this account. */
const accountHighlights = (account: Readwise.Readwise, get: Atom.Context): Highlight.Highlight[] => {
  const db = Obj.getDatabase(account);
  if (!db) {
    return [];
  }
  const highlights = get(db.query(Filter.type(Highlight.Highlight)).atom);
  return highlights.filter((highlight) => highlight.container.target?.id === account.id);
};

export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    const extensions = yield* Effect.all([
      // Section header under the SPACE › content group; present only when the space has ≥1 account.
      GraphBuilder.createExtension({
        id: 'readwiseSection',
        match: AppNodeMatcher.whenNavTreeGroup(Paths.GroupTypes.content),
        connector: (space, get) => {
          const accounts = get(space.db.query(Filter.type(Readwise.Readwise)).atom);
          if (accounts.length === 0) {
            return Effect.succeed([]);
          }
          return Effect.succeed([
            AppNode.makeSection({
              id: getReadwiseSectionId(),
              type: READWISE_SECTION_TYPE,
              label: ['readwise-section.label', { ns: meta.profile.key }],
              icon: 'ph--book-open--regular',
              iconHue: 'indigo',
              space,
              position: 320,
            }),
          ]);
        },
      }),

      // One node per account under the section, each nesting Sources + Highlights folders.
      GraphBuilder.createExtension({
        id: 'readwiseListing',
        match: (node) => {
          const space = isSpace(node.properties.space) ? node.properties.space : undefined;
          return node.type === READWISE_SECTION_TYPE && space ? Option.some(space) : Option.none();
        },
        connector: (space, get) => {
          const accounts = get(space.db.query(Filter.type(Readwise.Readwise)).atom);
          return Effect.succeed(
            accounts.map((account: Readwise.Readwise) => {
              const accountSnapshot = get(Obj.atom(account));
              return Node.make({
                id: account.id,
                type: readwiseTypename,
                data: account,
                properties: {
                  label: accountSnapshot.name ?? ['object-name.placeholder', { ns: readwiseTypename }],
                  icon: 'ph--book-open--regular',
                  iconHue: 'indigo',
                  role: 'branch',
                },
                nodes: [
                  Node.make({
                    id: getSourcesId(),
                    type: READWISE_SOURCES_TYPE,
                    data: READWISE_SOURCES_NODE_DATA,
                    properties: {
                      label: ['sources.label', { ns: meta.profile.key }],
                      icon: 'ph--bookmarks-simple--regular',
                      iconHue: 'indigo',
                      role: 'branch',
                      account,
                    },
                  }),
                  Node.make({
                    id: getHighlightsId(),
                    type: READWISE_HIGHLIGHTS_TYPE,
                    data: READWISE_HIGHLIGHTS_NODE_DATA,
                    properties: {
                      label: ['highlights.label', { ns: meta.profile.key }],
                      icon: 'ph--quotes--regular',
                      iconHue: 'amber',
                      role: 'branch',
                      account,
                    },
                  }),
                ],
              });
            }),
          );
        },
      }),

      // Sources folder: the distinct source documents (Bookmarks) referenced by the account's highlights.
      GraphBuilder.createExtension({
        id: 'readwiseSources',
        match: NodeMatcher.whenNodeType(READWISE_SOURCES_TYPE),
        connector: (node, get) => {
          const account = accountOf(node);
          const db = account ? Obj.getDatabase(account) : undefined;
          if (!account || !db) {
            return Effect.succeed([]);
          }
          const sources = new Map<string, Obj.Unknown>();
          for (const highlight of accountHighlights(account, get)) {
            const source = highlight.source.target;
            if (source && !sources.has(source.id)) {
              sources.set(source.id, source);
            }
          }
          return Effect.succeed(
            [...sources.values()]
              .map((object) => AppNode.makeObject({ get, db, object }))
              .filter((objectNode): objectNode is NonNullable<typeof objectNode> => objectNode !== null),
          );
        },
      }),

      // Highlights folder: every highlight synced into the account.
      GraphBuilder.createExtension({
        id: 'readwiseHighlights',
        match: NodeMatcher.whenNodeType(READWISE_HIGHLIGHTS_TYPE),
        connector: (node, get) => {
          const account = accountOf(node);
          const db = account ? Obj.getDatabase(account) : undefined;
          if (!account || !db) {
            return Effect.succeed([]);
          }
          return Effect.succeed(
            accountHighlights(account, get)
              .map((object) => AppNode.makeObject({ get, db, object }))
              .filter((objectNode): objectNode is NonNullable<typeof objectNode> => objectNode !== null),
          );
        },
      }),
    ]);

    return Capability.contributes(AppCapabilities.AppGraphBuilder, extensions);
  }),
);
