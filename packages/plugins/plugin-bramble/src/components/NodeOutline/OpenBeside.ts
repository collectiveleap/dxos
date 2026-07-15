//
// Copyright 2026 DXOS.org
//

import { createContext, useContext } from 'react';

import { type Node } from '../../types';

/** Opens a Node's secondary view alongside the current one (UP-5.open-beside). Supplied by the
 *  plugin's Surface (app-framework context); `null` outside it (e.g. storybook) → open-beside is a no-op. */
export const OpenBesideContext = createContext<((target: Node) => void) | null>(null);
export const useOpenBeside = (): ((target: Node) => void) | null => useContext(OpenBesideContext);
