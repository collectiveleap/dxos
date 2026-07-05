//
// Copyright 2026 DXOS.org
//

import React, { useCallback, useEffect, useState } from 'react';

import { useOperationInvoker } from '@dxos/app-framework/ui';
import { type AppSurface } from '@dxos/app-toolkit/ui';
import { Obj } from '@dxos/echo';
import { useObject } from '@dxos/echo-react';
import { Card, Icon, IconButton, Panel, ScrollArea, Select, Status, useTranslation } from '@dxos/react-ui';
import { Empty } from '@dxos/react-ui-list';
import { Task } from '@dxos/types';

import { meta } from '#meta';
import { INTENT_KINDS, type IntentKind, ReadwiseOperation } from '#types';

export type TriageCardProps = AppSurface.ObjectArticleProps<Task.Task>;

/** One suggested item plus Steve's editable decision over it, held in local component state. */
type ItemState = {
  readonly suggestedKind: IntentKind;
  readonly text: string;
  readonly note?: string;
  finalKind: IntentKind;
  accept: boolean;
};

/**
 * Renders a triage `Task` card: the source annotation (passage + note) and the AI's suggested
 * decomposition, with per-item accept / edit-kind / reject controls and a Confirm action that
 * materializes the accepted decisions via `ReadwiseOperation.Confirm`.
 *
 * On mount, if the card has no suggestion yet, this runs `ReadwiseOperation.Decompose` first
 * (idempotent) so `confirmItems`'s resolution recording is never a no-op — see Task 11's report:
 * confirming before a decomposition ran would silently skip recording the resolution.
 */
export const TriageCard = ({ role, subject }: TriageCardProps) => {
  const { t } = useTranslation(meta.profile.key);
  const { invokePromise } = useOperationInvoker();
  const [card] = useObject(subject);
  const db = Obj.getDatabase(subject);

  const [loading, setLoading] = useState(true);
  const [annotationText, setAnnotationText] = useState<string>();
  const [items, setItems] = useState<ItemState[]>();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    void invokePromise(ReadwiseOperation.Decompose, { card: subject }, { spaceId: db?.spaceId }).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error || !result.data) {
        setError(result.error?.message ?? t('decompose-failed.message'));
        setLoading(false);
        return;
      }
      setAnnotationText(result.data.annotationText || undefined);
      setItems(
        result.data.items.map((item) => ({
          suggestedKind: item.suggestedKind,
          text: item.text,
          note: item.note,
          finalKind: item.suggestedKind,
          accept: true,
        })),
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [subject, db?.spaceId, invokePromise]);

  const handleToggleAccept = useCallback((index: number) => {
    setItems((current) =>
      current?.map((item, itemIndex) => (itemIndex === index ? { ...item, accept: !item.accept } : item)),
    );
  }, []);

  const handleKindChange = useCallback((index: number, finalKind: IntentKind) => {
    setItems((current) => current?.map((item, itemIndex) => (itemIndex === index ? { ...item, finalKind } : item)));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!items) {
      return;
    }
    setConfirming(true);
    setError(undefined);
    try {
      const result = await invokePromise(
        ReadwiseOperation.Confirm,
        { card: subject, decisions: items },
        { spaceId: db?.spaceId },
      );
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setConfirmed(true);
    } finally {
      setConfirming(false);
    }
  }, [items, subject, db?.spaceId, invokePromise]);

  // A resolution already exists once the card moves to Done — disable further edits/re-confirm
  // rather than risk materializing duplicate results (Task 11's report flagged `confirmItems` as
  // unguarded against a double-confirm).
  const done = confirmed || card?.status === 'done';

  return (
    <Panel.Root role={role}>
      <Panel.Content asChild>
        <ScrollArea.Root orientation='vertical'>
          <ScrollArea.Viewport classNames='p-4 space-y-4'>
            {loading && <Status indeterminate aria-label={t('loading.label')} />}

            {error && <p className='text-error-text'>{error}</p>}

            {!loading && annotationText && (
              <Card.Root data-testid='triage-card-annotation'>
                <Card.Body>
                  <Card.Text>{annotationText}</Card.Text>
                </Card.Body>
              </Card.Root>
            )}

            {!loading && items?.length === 0 && <Empty label={t('no-suggested-items.message')} />}

            {!loading &&
              items?.map((item, index) => (
                <Card.Root key={index} data-testid='triage-card-item'>
                  <Card.Header>
                    <Card.Block>
                      <Icon icon='ph--sparkle--regular' />
                    </Card.Block>
                    <div className='flex flex-col gap-0.5 min-w-0'>
                      <Card.Title classNames='line-clamp-2'>{item.text}</Card.Title>
                      {item.note && <span className='text-sm text-description'>{item.note}</span>}
                    </div>
                    <Card.Block>
                      <IconButton
                        iconOnly
                        label={item.accept ? t('reject-item.label') : t('accept-item.label')}
                        icon={item.accept ? 'ph--x--regular' : 'ph--check--regular'}
                        onClick={() => handleToggleAccept(index)}
                        disabled={done}
                      />
                    </Card.Block>
                  </Card.Header>
                  <Card.Body>
                    <Select.Root
                      value={item.finalKind}
                      // Radix's `onValueChange` is untyped `(value: string) => void`; the options
                      // rendered below are drawn exhaustively from `INTENT_KINDS`, so the value is
                      // always one of them.
                      onValueChange={(value) => handleKindChange(index, value as IntentKind)}
                      disabled={!item.accept || done}
                    >
                      <Select.TriggerButton placeholder={t('item-kind.label')} />
                      <Select.Portal>
                        <Select.Content>
                          <Select.Viewport>
                            {INTENT_KINDS.map((kind) => (
                              <Select.Option key={kind} value={kind}>
                                {t(`item-kind-${kind}.label`)}
                              </Select.Option>
                            ))}
                          </Select.Viewport>
                          <Select.Arrow />
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </Card.Body>
                </Card.Root>
              ))}
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      </Panel.Content>
      <Panel.Statusbar size='sm'>
        <IconButton
          label={done ? t('confirmed.label') : t('confirm.label')}
          icon='ph--check-circle--regular'
          onClick={handleConfirm}
          disabled={loading || confirming || done || !items}
        />
      </Panel.Statusbar>
    </Panel.Root>
  );
};

export default TriageCard;
