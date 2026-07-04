//
// Copyright 2026 DXOS.org
//

import { type Meta, type StoryObj } from '@storybook/react-vite';
import * as Effect from 'effect/Effect';
import React from 'react';

import { withPluginManager } from '@dxos/app-framework/testing';
import { type Database, Filter, JsonSchema, Obj, Query, Ref, View } from '@dxos/echo';
import { URI } from '@dxos/keys';
import { ClientPlugin, initializeIdentity } from '@dxos/plugin-client/testing';
import { Kanban } from '@dxos/plugin-kanban';
import { SpacePlugin } from '@dxos/plugin-space/testing';
import { StorybookPlugin, corePlugins } from '@dxos/plugin-testing';
import { useQuery, useSpaces } from '@dxos/react-client/echo';
import { Loading, withLayout } from '@dxos/react-ui/testing';
import { ViewModel } from '@dxos/schema';
import { Task } from '@dxos/types';

import { TRIAGE_TAG } from '../../constants';
import { TriageBoard } from './TriageBoard';

/** Seeds a handful of triage `Task`s across all three statuses so the board renders every column with content. */
const seedTriageTasks = (db: Database.Database) => {
  const statuses: Array<Task.Task['status'] & string> = ['todo', 'in-progress', 'done'];
  statuses.forEach((status, statusIndex) => {
    Array.from({ length: statusIndex + 1 }).forEach((_, index) => {
      db.add(
        Task.make({
          [Obj.Meta]: { tags: [Ref.fromURI(URI.make(TRIAGE_TAG))] },
          title: `${status} highlight ${index + 1}`,
          status,
        }),
      );
    });
  });
};

const DefaultStory = () => {
  const spaces = useSpaces();
  const space = spaces[spaces.length - 1];
  const [kanban] = useQuery(space?.db, Filter.type(Kanban.Kanban));

  if (!kanban) {
    return <Loading />;
  }

  return <TriageBoard kanban={kanban} />;
};

const meta = {
  title: 'plugins/plugin-readwise/containers/TriageBoard',
  component: DefaultStory,
  decorators: [
    withLayout({ layout: 'fullscreen' }),
    withPluginManager({
      plugins: [
        ...corePlugins(),
        ClientPlugin({
          types: [Task.Task, View.View, Kanban.Kanban],
          onClientInitialized: ({ client }) =>
            Effect.gen(function* () {
              yield* initializeIdentity(client);
              const space = yield* Effect.promise(() => client.spaces.create());
              yield* Effect.promise(() => space.waitUntilReady());

              const view = ViewModel.make({
                query: Query.select(Filter.type(Task.Task)).select(Filter.tag(TRIAGE_TAG)),
                jsonSchema: JsonSchema.toJsonSchema(Task.Task),
                pivotFieldName: 'status',
              });
              space.db.add(view);
              const kanban = Kanban.make({ name: 'Readwise Triage', view });
              space.db.add(kanban);

              seedTriageTasks(space.db);
            }),
        }),
        SpacePlugin({}),
        StorybookPlugin({}),
      ],
    }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DefaultStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
