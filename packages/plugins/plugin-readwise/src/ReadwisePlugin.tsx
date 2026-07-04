//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { Message, Task } from '@dxos/types';

import { OperationHandler } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';

/**
 * Registers the reused ECHO types this plugin queries and creates from Readwise
 * items — Task and Message from `@dxos/types`, Bookmark from `@dxos/plugin-bookmarks`.
 * This plugin defines no new ECHO types of its own.
 */
export const ReadwisePlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({ schema: [Task.Task, Message.Message, Bookmark.Bookmark] }),
  AppPlugin.addOperationHandlerModule({ activate: OperationHandler }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default ReadwisePlugin;
