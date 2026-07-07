//
// Copyright 2026 DXOS.org
//

import { meta } from '#meta';

/** App-graph node `type` for a space's Inbox view. */
export const INBOX_NODE_TYPE = `${meta.profile.key}.inbox`;

/** Sentinel `data` for the Inbox view node (non-null so the nav tree can select it). */
export const INBOX_NODE_DATA = `${meta.profile.key}.inbox-view` as const;
