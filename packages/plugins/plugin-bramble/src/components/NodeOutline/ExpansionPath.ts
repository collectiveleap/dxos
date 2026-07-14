//
// Copyright 2026 DXOS.org
//

import { createContext, useContext } from 'react';

/** The set of secondary-view SUBJECT ids on the current inline-expansion nesting path. A mention
 *  whose target is already in this set must not expand again (cycle guard). Seeded per NodeOutline. */
export const ExpansionPathContext = createContext<ReadonlySet<string>>(new Set());
export const useExpansionPath = (): ReadonlySet<string> => useContext(ExpansionPathContext);
