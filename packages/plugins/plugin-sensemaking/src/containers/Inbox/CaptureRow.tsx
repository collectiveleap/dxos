//
// Copyright 2026 DXOS.org
//

import React, { useCallback, useState } from 'react';

import { Surface, useOperationInvoker } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';
import { Collection, Entity, Filter, Query, Ref } from '@dxos/echo';
import { type Space, useQuery } from '@dxos/react-client/echo';
import { Button, DropdownMenu, IconButton, Input, useTranslation } from '@dxos/react-ui';

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
  const [adding, setAdding] = useState(false);
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
      setAdding(false);
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

  const removeResult = useCallback(
    (result: Result.Result) => {
      // Deletes the Result object. The `DerivedFrom` relation is left in place; it dangles harmlessly
      // (the reverse-query filters by `Result.instanceOf`, so an orphaned relation never renders).
      space.db.remove(result);
    },
    [space],
  );

  if (!source) {
    return null;
  }

  const triageResults = results.filter(Result.instanceOf);

  return (
    <div className='plb-2 border-bs border-dashed border-separator first:border-bs-0 first:pbs-0'>
      <Surface.Surface type={AppSurface.CardContent} data={{ subject: source }} limit={1} />
      {triageResults.length > 0 && (
        <div className='flex flex-col gap-1.5 mbs-1.5 pbs-1.5 border-bs border-dashed border-separator'>
          {triageResults.map((result) => (
            <div key={result.id} className='grid grid-cols-[17px_1fr_auto] gap-2 items-start text-xs'>
              <span
                aria-hidden
                className={`is-4 bs-4 mbs-0.5 rounded grid place-items-center text-[9px] text-white ${
                  result.kind === 'todo' ? 'bg-blue-600' : 'bg-purple-600'
                }`}
              >
                {result.kind === 'todo' ? '✓' : '?'}
              </span>
              <span className='min-is-0'>
                {result.body}
                <span className='block text-[10px] text-description'>{t('result-trace.label')}</span>
              </span>
              <IconButton
                iconOnly
                variant='ghost'
                density='sm'
                icon='ph--x--regular'
                size={3}
                label={t('result-remove.label')}
                classNames='text-subdued'
                onClick={() => removeResult(result)}
              />
            </div>
          ))}
        </div>
      )}
      <div className='flex items-center gap-2 flex-wrap mbs-1.5'>
        {adding ? (
          <div className='flex items-center gap-2 flex-wrap'>
            <Input.Root>
              <Input.TextInput
                autoFocus
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t('result-body.placeholder')}
                classNames='is-64'
              />
            </Input.Root>
            <Button density='sm' onClick={() => addResult('todo')}>
              {t('result-todo.label')}
            </Button>
            <Button density='sm' onClick={() => addResult('question')}>
              {t('result-question.label')}
            </Button>
          </div>
        ) : (
          <Button density='sm' onClick={() => setAdding(true)}>
            {`${t('result-add.label')} ▾`}
          </Button>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button density='sm'>{t('connect.label')}</Button>
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
    </div>
  );
};
