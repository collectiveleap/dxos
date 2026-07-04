//
// Copyright 2026 DXOS.org
//

import { BaseError } from '@dxos/errors';

/** Raised when a Readwise REST API request fails or returns an unexpected payload. */
export class ReadwiseError extends BaseError.extend('ReadwiseError', 'Readwise request failed.') {}

/** User-facing diagnostic string for failures from the Readwise sync path, recorded on `Cursor.lastError`. */
export const formatReadwiseSyncFailure = (error: unknown): string => {
  if (error instanceof BaseError) {
    const keys = Object.keys(error.context);
    return keys.length > 0 ? `${error.name}: ${JSON.stringify(error.context)}` : error.name;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};
