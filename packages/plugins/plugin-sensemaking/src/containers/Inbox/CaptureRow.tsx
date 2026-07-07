//
// Copyright 2026 DXOS.org
//

import React, { useCallback, useState } from 'react';

import { Surface, useOperationInvoker } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';
import { Collection, Entity, Filter, Query, Ref } from '@dxos/echo';
import { type Space, useQuery } from '@dxos/react-client/echo';
import { Button, DropdownMenu, Input, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';
import { Capture, DerivedFrom, Result, SensemakingOperation } from '#types';

export type CaptureRowProps = {
  readonly capture: Capture.Capture;
  readonly space: Space;
};

export const CaptureRow = ({ capture, space }: CaptureRowProps) => {
  const { t } = useTranslation(meta.profile.key);
  const { invokePromise } = useOperationInvoker();
  const [body, setBody] = useState('');
  const source = capture.source.target;
  const collections = useQuery(space.db, Filter.type(Collection.Collection));
  // Every Result whose `DerivedFrom` relation targets this capture. Typed via `DerivedFrom.source`
  // (a `Result.Result`), so the reverse-query needs no cast.
  const results = useQuery(space.db, Query.select(Filter.id(capture.id)).targetOf(DerivedFrom.DerivedFrom).source());

  const addResult = useCallback(
    async (kind: Result.Kind) => {
      if (body.trim().length === 0) {
        return;
      }
      await invokePromise(
        SensemakingOperation.CreateResult,
        { capture: Ref.make(capture), kind, body: body.trim() },
        { spaceId: space.db?.spaceId },
      );
      setBody('');
    },
    [body, capture, invokePromise, space],
  );

  const connectTo = useCallback(
    async (collection: Collection.Collection) => {
      await invokePromise(
        SensemakingOperation.Connect,
        { capture: Ref.make(capture), target: Ref.make(collection) },
        { spaceId: space.db?.spaceId },
      );
    },
    [capture, invokePromise, space],
  );

  if (!source) {
    return null;
  }

  return (
    <div className='mbe-2'>
      <Surface.Surface type={AppSurface.CardContent} data={{ subject: source }} limit={1} />
      <div className='flex items-center gap-2 plb-1.5'>
        <Input.Root>
          <Input.TextInput
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t('result-body.placeholder')}
            classNames='flex-1'
          />
        </Input.Root>
        <Button onClick={() => addResult('todo')}>{`+ ${t('result-todo.label')}`}</Button>
        <Button onClick={() => addResult('question')}>{`+ ${t('result-question.label')}`}</Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button>{t('connect.label')}</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content>
              <DropdownMenu.Viewport>
                {collections.length === 0 ? (
                  <DropdownMenu.Item disabled>{t('no-projects.message')}</DropdownMenu.Item>
                ) : (
                  collections.map((collection) => (
                    <DropdownMenu.Item key={collection.id} onClick={() => connectTo(collection)}>
                      {Entity.getLabel(collection) ?? t('uncategorized.label')}
                    </DropdownMenu.Item>
                  ))
                )}
              </DropdownMenu.Viewport>
              <DropdownMenu.Arrow />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {results.filter(Result.instanceOf).map((result) => (
        <div key={result.id} className='flex items-baseline gap-2 pis-4 plb-0.5 text-sm text-description'>
          <span className='font-medium'>
            {result.kind === 'todo' ? t('result-todo.label') : t('result-question.label')}
          </span>
          <span>{result.body}</span>
        </div>
      ))}
    </div>
  );
};
