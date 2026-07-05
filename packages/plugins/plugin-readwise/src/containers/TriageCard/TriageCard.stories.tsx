//
// Copyright 2026 DXOS.org
//

import * as LanguageModel from '@effect/ai/LanguageModel';
import { type Meta, type StoryObj } from '@storybook/react-vite';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import React from 'react';

import { AiService } from '@dxos/ai';
import { withPluginManager } from '@dxos/app-framework/testing';
import { type Database, Filter, Obj, Ref, Relation } from '@dxos/echo';
import { URI } from '@dxos/keys';
import { AssistantPlugin } from '@dxos/plugin-assistant/plugin';
import { ClientPlugin, initializeIdentity } from '@dxos/plugin-client/testing';
import { SpacePlugin } from '@dxos/plugin-space/testing';
import { StorybookPlugin, corePlugins } from '@dxos/plugin-testing';
import { useQuery, useSpaces } from '@dxos/react-client/echo';
import { Loading, withLayout } from '@dxos/react-ui/testing';
import { AnchoredTo, Message, Task } from '@dxos/types';

import { ReadwisePlugin } from '#plugin';
import { translations } from '#translations';

import { TRIAGE_TAG } from '../../constants';
import { TriageCard } from './TriageCard';

/** Canned decomposition the mock AI returns — mirrors `decompose.test.ts`'s fixture. */
const MOCK_DECOMPOSITION = {
  items: [
    { suggestedKind: 'question', text: 'Should we adopt this pattern for the new module?' },
    { suggestedKind: 'todo', text: 'Follow up with the team about migration timeline.' },
  ],
};

/** Deterministic `AiService` middleware so the story never calls a real model. */
const mockAiServiceMiddleware = (): ((upstream: AiService.Service) => AiService.Service) =>
  (_upstream: AiService.Service) => ({
    model: () =>
      Layer.succeed(LanguageModel.LanguageModel, {
        generateObject: () => Effect.succeed(new LanguageModel.GenerateObjectResponse(MOCK_DECOMPOSITION, [])),
        generateText: () => Effect.succeed(new LanguageModel.GenerateTextResponse([])),
        streamText: () => Stream.empty,
        // `LanguageModel.Service['generateObject']` is generic over the caller's requested result
        // type `A`; a fixed test double can't produce a value of an arbitrary caller-chosen `A`
        // without a cast at this one boundary (mirrors `decompose.test.ts`'s identical mock).
      } as LanguageModel.Service),
  });

/** Seeds one triage `Task` with its anchored annotation `Message` (passage + note). */
const seedTriageCard = (db: Database.Database) => {
  const annotation = db.add(
    Message.make({
      sender: 'user',
      blocks: [
        { _tag: 'text', text: 'Effect provides structured concurrency primitives.' },
        {
          _tag: 'text',
          text: 'Should we adopt this pattern for the new module? Follow up with the team about migration timeline.',
        },
      ],
      properties: { readwiseId: 'rw-story-1' },
    }),
  );
  const card = db.add(
    Task.make({
      [Obj.Meta]: { tags: [Ref.fromURI(URI.make(TRIAGE_TAG))] },
      title: 'Effect provides structured concurrency primitives.',
      status: 'todo',
    }),
  );
  db.add(Relation.make(AnchoredTo.AnchoredTo, { [Relation.Source]: card, [Relation.Target]: annotation }));
  return card;
};

const DefaultStory = () => {
  const spaces = useSpaces();
  const space = spaces[spaces.length - 1];
  const [card] = useQuery(space?.db, Filter.type(Task.Task));

  if (!card) {
    return <Loading />;
  }

  return <TriageCard role='article' subject={card} attendableId='triage-card-story' />;
};

const meta = {
  title: 'plugins/plugin-readwise/containers/TriageCard',
  component: DefaultStory,
  decorators: [
    withLayout({ layout: 'fullscreen' }),
    withPluginManager({
      plugins: [
        ...corePlugins(),
        ClientPlugin({
          types: [Task.Task, Message.Message, AnchoredTo.AnchoredTo],
          onClientInitialized: ({ client }) =>
            Effect.gen(function* () {
              yield* initializeIdentity(client);
              const space = yield* Effect.promise(() => client.spaces.create());
              yield* Effect.promise(() => space.waitUntilReady());
              seedTriageCard(space.db);
            }),
        }),
        SpacePlugin({}),
        AssistantPlugin({ aiServiceMiddleware: mockAiServiceMiddleware() }),
        ReadwisePlugin(),
        StorybookPlugin({}),
      ],
    }),
  ],
  parameters: {
    layout: 'fullscreen',
    translations,
  },
} satisfies Meta<typeof DefaultStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
