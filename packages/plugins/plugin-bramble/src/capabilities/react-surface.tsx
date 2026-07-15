//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import React, { useCallback } from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface, useOperationInvoker } from '@dxos/app-framework/ui';
import { LayoutOperation, Paths } from '@dxos/app-toolkit';
import { AppSurface } from '@dxos/app-toolkit/ui';

import { NodeOutline } from '../components';
import { OpenBesideContext } from '../components/NodeOutline/OpenBeside';
import { Node } from '../types';

// Bramble's Surface is the only place with app-framework context, so it supplies the open-beside
// handler: dispatch LayoutOperation.Open with the target's navigation path — a new plank alongside the
// current view (UP-5.open-beside). `pivotId` (exact adjacency) is a follow-up.
const BrambleOutlineSurface = ({ role, subject }: { role?: string; subject: Node }) => {
  const { invokePromise } = useOperationInvoker();
  const openBeside = useCallback(
    (target: Node) => {
      void invokePromise(LayoutOperation.Open, {
        subject: [Paths.getObjectPathFromObject(target)],
        navigation: 'immediate',
      });
    },
    [invokePromise],
  );
  return (
    <OpenBesideContext.Provider value={openBeside}>
      <NodeOutline role={role} subject={subject} />
    </OpenBesideContext.Provider>
  );
};

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      Surface.create({
        id: 'article.brambleOutline',
        filter: AppSurface.oneOf(
          AppSurface.object(AppSurface.Article, Node),
          AppSurface.object(AppSurface.Section, Node),
        ),
        component: ({ role, data }) => <BrambleOutlineSurface role={role} subject={data.subject} />,
      }),
    ]),
  ),
);
