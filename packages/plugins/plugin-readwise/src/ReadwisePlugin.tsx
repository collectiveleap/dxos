//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';
import { View } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { Kanban } from '@dxos/plugin-kanban';
import { Message, Task } from '@dxos/types';

import { OperationHandler, ReactSurface } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';

// eslint-disable-next-line import/no-relative-packages
import pluginSpec from '../PLUGIN.mdl?raw';

/**
 * Registers the reused ECHO types this plugin queries and creates from Readwise
 * items — Task and Message from `@dxos/types`, Bookmark from `@dxos/plugin-bookmarks`, and
 * View/Kanban from `@dxos/echo`/`@dxos/plugin-kanban` (the triage board `ensureTriageBoard`
 * materializes). This plugin defines no new ECHO types of its own.
 */
export const ReadwisePlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({ schema: [Task.Task, Message.Message, Bookmark.Bookmark, View.View, Kanban.Kanban] }),
  AppPlugin.addOperationHandlerModule({ activate: OperationHandler }),
  AppPlugin.addSurfaceModule({ activate: ReactSurface }),
  AppPlugin.addPluginAssetModule({
    asset: { pluginId: meta.profile.key, path: 'PLUGIN.mdl', content: pluginSpec, mimeType: 'application/x-mdl' },
  }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default ReadwisePlugin;
