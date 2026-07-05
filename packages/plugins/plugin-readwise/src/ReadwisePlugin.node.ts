//
// Copyright 2026 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';
import { Bookmark } from '@dxos/plugin-bookmarks';

import { OperationHandler } from '#capabilities';
import { meta } from '#meta';
import { Highlight, Readwise } from '#types';

/**
 * Headless variant of ReadwisePlugin (no React surfaces).
 * Used in node contexts (CLI, agents) where rendering is unavailable.
 */
export const ReadwisePlugin = Plugin.define(meta).pipe(
  AppPlugin.addSchemaModule({ schema: [Readwise.Readwise, Highlight.Highlight, Bookmark.Bookmark] }),
  AppPlugin.addOperationHandlerModule({ activate: OperationHandler }),
  Plugin.make,
);

export default ReadwisePlugin;
