//
// Copyright 2025 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';

import { AppGraphBuilder, CreateObject, ReactSurface } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';
import { Bramble } from '#types';

export const BramblePlugin = Plugin.define(meta).pipe(
  // F-One-Graph + F-No-Root: contributes the navigator's "Bramble"
  // create entry. The handler is idempotent: invoking it when a
  // Bramble.Graph already exists in the space returns the existing
  // one and navigates the user to today's Node. The Bramble.Step /
  // Bramble.Run / Bramble.Day types do NOT contribute their own
  // create entries — those types are materialized indirectly (Step
  // via the supertag picker on a bullet, Run via Step actions, Day
  // via the Today / Day-of-week navigation paths).
  AppPlugin.addCreateObjectModule({ activate: CreateObject }),
  AppPlugin.addSchemaModule({
    schema: [Bramble.Node, Bramble.Edge, Bramble.Graph, Bramble.Step, Bramble.Run, Bramble.Day],
  }),
  AppPlugin.addSurfaceModule({ activate: ReactSurface }),
  // F-Bramble-Nav: per-space "Bramble" sidebar section. The
  // capability matches whenSpace, contributing the section + its
  // Today + All Tags children iff the space contains a Bramble.
  AppPlugin.addAppGraphModule({ activate: AppGraphBuilder }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default BramblePlugin;
