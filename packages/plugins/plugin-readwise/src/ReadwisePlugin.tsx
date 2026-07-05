//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';
import { Bookmark } from '@dxos/plugin-bookmarks';

import { OperationHandler, ReactSurface } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';

// eslint-disable-next-line import/no-relative-packages
import pluginSpec from '../PLUGIN.mdl?raw';

/**
 * Registers the reused ECHO types this plugin queries and creates from Readwise
 * items — Bookmark from `@dxos/plugin-bookmarks`. This plugin defines no new ECHO types of its own.
 */
export const ReadwisePlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({ schema: [Bookmark.Bookmark] }),
  AppPlugin.addOperationHandlerModule({ activate: OperationHandler }),
  AppPlugin.addSurfaceModule({ activate: ReactSurface }),
  AppPlugin.addPluginAssetModule({
    asset: { pluginId: meta.profile.key, path: 'PLUGIN.mdl', content: pluginSpec, mimeType: 'application/x-mdl' },
  }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default ReadwisePlugin;
