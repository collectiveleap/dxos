//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';

import { OperationHandler } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';
import { Capture, ConnectedTo, DerivedFrom, Result } from '#types';

export const SensemakingPlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({
    schema: [Capture.Capture, Result.Result, DerivedFrom.DerivedFrom, ConnectedTo.ConnectedTo],
  }),
  AppPlugin.addOperationHandlerModule({ activate: OperationHandler }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default SensemakingPlugin;
