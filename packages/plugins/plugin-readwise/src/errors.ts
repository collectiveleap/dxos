//
// Copyright 2026 DXOS.org
//

import { BaseError } from '@dxos/errors';

/** Raised when a Readwise REST API request fails or returns an unexpected payload. */
export class ReadwiseError extends BaseError.extend('ReadwiseError', 'Readwise request failed.') {}
