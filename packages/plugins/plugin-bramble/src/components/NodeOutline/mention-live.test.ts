//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { type EchoDatabase } from '@dxos/echo-client';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { Doc } from '@dxos/echo-doc';
import { Text } from '@dxos/schema';

import { Edge, Node, makeNode } from '../../types';

// BR-4 / I3c: a mention chip's label must update per keystroke when its target's text changes. The fix
// has the mentioning row (Y) subscribe to the target's LIVE text via the automerge accessor-`change`
// signal — the same one the editor itself uses to stay in sync. `useQuery` alone does NOT re-render Y on
// a target's in-place edit (it's over Y's own edges), which is why the label lagged until Enter. This
// verifies the signal fires when the text is written the editor's way, and that `.content` reflects it
// live (what `resolveLabel` reads).
describe('live mention labels (BR-4)', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase({ types: [Node, Edge, Text.Text] }));
  });
  afterEach(async () => {
    await builder.close();
  });

  test("an observer's accessor-change listener fires when the target text is edited (the editor's write path)", async ({
    expect,
  }) => {
    const target = db.add(makeNode({ text: 'hello world' }));
    await db.flush();
    const text = target.text!.target!;

    // Y observes the target's text exactly as RowEditor's live-labels effect does.
    const observer = Doc.createAccessor(text, ['content']);
    let fired = 0;
    const onChange = () => {
      fired++;
    };
    observer.handle.addListener('change', onChange);

    // A keystroke on the target: write via the editor's path (accessor.handle.change + A.updateText).
    Doc.updateText(text, ['content'], 'hello worldy');
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the handle's change event propagate

    observer.handle.removeListener('change', onChange);
    expect(fired).toBeGreaterThan(0); // the chip would refresh here
    expect(text.content).toBe('hello worldy'); // and resolveLabel reads this live value
  });
});
