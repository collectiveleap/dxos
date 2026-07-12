//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';

import { CreateObject } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';
import { Edge, Node } from '#types';

export const BramblePlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({ schema: [Node, Edge] }),
  AppPlugin.addCreateObjectModule({ activate: CreateObject }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default BramblePlugin;
