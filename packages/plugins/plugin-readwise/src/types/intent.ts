// @import-as-namespace

export type IntentKind = 'comment' | 'question' | 'todo';

export const INTENT_KINDS = ['comment', 'question', 'todo'] as const;

export type Representation = 'message' | 'task';

export const resultKindRegistry: Record<IntentKind, { tag: string; representation: Representation }> = {
  comment: {
    tag: 'org.dxos.plugin.readwise/comment',
    representation: 'message',
  },
  question: {
    tag: 'org.dxos.plugin.readwise/question',
    representation: 'task',
  },
  todo: {
    tag: 'org.dxos.plugin.readwise/todo',
    representation: 'task',
  },
};

export const representationFor = (kind: IntentKind): Representation => resultKindRegistry[kind].representation;
