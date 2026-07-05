//
// Copyright 2026 DXOS.org
//

import { ActivationEvent, Plugin } from '@dxos/app-framework';
import { AppActivationEvents, AppPlugin } from '@dxos/app-toolkit';
import { AttentionEvents } from '@dxos/plugin-attention';
import { Bookmark } from '@dxos/plugin-bookmarks';

import { AppGraphBuilder, Connector, CreateObject, OperationHandler, ReactSurface } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';
import { Highlight, Readwise } from '#types';

// eslint-disable-next-line import/no-relative-packages
import pluginSpec from '../PLUGIN.mdl?raw';

/**
 * Registers the plugin's own `Readwise` and `Highlight` ECHO types plus the reused `Bookmark`
 * (source documents).
 */
export const ReadwisePlugin = Plugin.define(meta).pipe(
  AppPlugin.addAppGraphModule({
    activatesOn: ActivationEvent.allOf(AppActivationEvents.SetupAppGraph, AttentionEvents.AttentionReady),
    activate: AppGraphBuilder,
  }),
  AppPlugin.addSchemaModule({ schema: [Readwise.Readwise, Highlight.Highlight, Bookmark.Bookmark] }),
  AppPlugin.addCreateObjectModule({ activate: CreateObject }),
  AppPlugin.addOperationHandlerModule({ activate: OperationHandler }),
  AppPlugin.addSurfaceModule({ activate: ReactSurface }),
  AppPlugin.addPluginAssetModule({
    asset: { pluginId: meta.profile.key, path: 'PLUGIN.mdl', content: pluginSpec, mimeType: 'application/x-mdl' },
  }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.addModule({ activatesOn: AppActivationEvents.SetupConnectors, activate: Connector }),
  Plugin.make,
);

export default ReadwisePlugin;
