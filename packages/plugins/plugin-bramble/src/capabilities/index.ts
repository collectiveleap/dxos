//
// Copyright 2025 DXOS.org
//

import { Capability } from '@dxos/app-framework';

export const ReactSurface = Capability.lazy('ReactSurface', () => import('./react-surface'));
export const AppGraphBuilder = Capability.lazy('AppGraphBuilder', () => import('./app-graph-builder'));
export const CreateObject = Capability.lazy('CreateObject', () => import('./create-object'));
