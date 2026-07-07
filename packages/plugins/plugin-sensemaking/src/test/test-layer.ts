//
// Copyright 2026 DXOS.org
//

import { EchoTestBuilder } from '@dxos/echo-client/testing';

import { Capture, ConnectedTo, DerivedFrom, Result } from '../types';

/**
 * A fresh in-memory ECHO space registering the sensemaking types, for tests that exercise the plain
 * triage functions directly against a real database.
 */
export const TestLayer = async () => {
  const builder = await new EchoTestBuilder().open();
  const { db } = await builder.createDatabase({
    types: [Capture.Capture, Result.Result, DerivedFrom.DerivedFrom, ConnectedTo.ConnectedTo],
  });

  return {
    db,
    close: () => builder.close(),
  };
};
