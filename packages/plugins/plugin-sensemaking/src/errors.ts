//
// Copyright 2026 DXOS.org
//

import { BaseError } from '@dxos/errors';

/** Raised when a triage operation's capture ref resolves to an object with no reachable database. */
export class DatabaseNotFoundError extends BaseError.extend(
  'DatabaseNotFoundError',
  'No database is derivable from the capture (ref not resolved).',
) {}
