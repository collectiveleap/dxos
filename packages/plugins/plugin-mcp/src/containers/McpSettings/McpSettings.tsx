//
// Copyright 2025 DXOS.org
//

import React, { useCallback } from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { Button, Input, useTranslation } from '@dxos/react-ui';
import { Settings as SettingsForm } from '@dxos/react-ui-form';

import { meta } from '#meta';
import type { Settings } from '#types';

export type McpSettingsProps = AppSurface.SettingsArticleProps<Settings.Settings>;

const generateId = () => Math.random().toString(36).slice(2, 10);

export const McpSettings = ({ settings, onSettingsChange }: McpSettingsProps) => {
  const { t } = useTranslation(meta.id);

  const handleAddServer = useCallback(() => {
    onSettingsChange?.((current) => ({
      ...current,
      servers: [
        ...(current.servers ?? []),
        { id: generateId(), name: '', url: '', protocol: 'http' as const },
      ],
    }));
  }, [onSettingsChange]);

  const handleRemoveServer = useCallback(
    (id: string) => {
      onSettingsChange?.((current) => ({
        ...current,
        servers: (current.servers ?? []).filter((server) => server.id !== id),
      }));
    },
    [onSettingsChange],
  );

  const handleUpdateServer = useCallback(
    (id: string, field: string, value: string) => {
      onSettingsChange?.((current) => ({
        ...current,
        servers: (current.servers ?? []).map((server) =>
          server.id === id ? { ...server, [field]: value } : server,
        ),
      }));
    },
    [onSettingsChange],
  );

  return (
    <SettingsForm.Viewport>
      <SettingsForm.Section title={t('plugin.name')}>
        {(settings.servers ?? []).map((server) => (
          <div key={server.id} className='flex flex-col gap-2 p-2 border rounded'>
            <SettingsForm.Item title={t('server-name.placeholder')}>
              <Input.TextInput
                placeholder={t('server-name.placeholder')}
                value={server.name}
                onChange={(event) => handleUpdateServer(server.id, 'name', event.target.value)}
              />
            </SettingsForm.Item>
            <SettingsForm.Item title={t('server-url.placeholder')}>
              <Input.TextInput
                placeholder={t('server-url.placeholder')}
                value={server.url}
                onChange={(event) => handleUpdateServer(server.id, 'url', event.target.value)}
              />
            </SettingsForm.Item>
            <SettingsForm.Item title={t('protocol.label')}>
              <select
                value={server.protocol}
                onChange={(event) => handleUpdateServer(server.id, 'protocol', event.target.value)}
                className='px-2 py-1 border rounded'
              >
                <option value='http'>HTTP</option>
                <option value='sse'>SSE</option>
              </select>
            </SettingsForm.Item>
            <Button variant='ghost' onClick={() => handleRemoveServer(server.id)}>
              {t('remove-server.label')}
            </Button>
          </div>
        ))}
        <Button onClick={handleAddServer}>{t('add-server.label')}</Button>
      </SettingsForm.Section>
    </SettingsForm.Viewport>
  );
};

export default McpSettings;
