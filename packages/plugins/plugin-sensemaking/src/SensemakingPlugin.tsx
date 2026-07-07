//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';

import { meta } from '#meta';
import { translations } from '#translations';
import { Capture } from '#types';

export const SensemakingPlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({ schema: [Capture.Capture] }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default SensemakingPlugin;
