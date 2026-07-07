//
// Copyright 2026 DXOS.org
//

import { ActivationEvent, Plugin } from '@dxos/app-framework';
import { AppActivationEvents, AppPlugin } from '@dxos/app-toolkit';
import { AttentionEvents } from '@dxos/plugin-attention';

import { AppGraphBuilder, OperationHandler, ReactSurface } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';
import { Capture, ConnectedTo, DerivedFrom, Result } from '#types';

export const SensemakingPlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({
    schema: [Capture.Capture, Result.Result, DerivedFrom.DerivedFrom, ConnectedTo.ConnectedTo],
  }),
  AppPlugin.addAppGraphModule({
    activatesOn: ActivationEvent.allOf(AppActivationEvents.SetupAppGraph, AttentionEvents.AttentionReady),
    activate: AppGraphBuilder,
  }),
  AppPlugin.addOperationHandlerModule({ activate: OperationHandler }),
  AppPlugin.addSurfaceModule({ activate: ReactSurface }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default SensemakingPlugin;
