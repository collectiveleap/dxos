//
// Copyright 2026 DXOS.org
//

/** `ConnectorEntry.id` for Readwise; stored as `Connection.connectorId` and used to route sync. */
export const READWISE_CONNECTOR_ID = 'readwise';

/** Base URL for the Readwise REST API. */
export const READWISE_API_BASE = 'https://readwise.io/api/v2';

/** `AccessToken.source` value for Readwise credentials. */
export const READWISE_SOURCE = 'readwise.io';

/**
 * Foreign-key `source` for a Bookmark's canonical-URL referent key. Forward-compat only: lets a
 * future cross-source capture (e.g. a Bluesky post linking the same article) find the same
 * Bookmark by canonical URL. Inc-1 dedup of captured Bookmarks stays keyed by {@link READWISE_SOURCE}.
 */
export const CANONICAL_URL_SOURCE = 'canonical-url';

/**
 * Default recent-history window (in days) for a binding's first sync, applied when its cursor has
 * no `value` yet. Bounds the initial pull instead of fetching the account's entire history. Inc 5's
 * sync-criteria picker will let this be configured per binding; this constant is the field's
 * default until that picker exists.
 */
export const DEFAULT_SYNC_WINDOW_DAYS = 30;
