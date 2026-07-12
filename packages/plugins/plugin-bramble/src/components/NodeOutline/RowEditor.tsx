//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Doc } from '@dxos/echo-doc';
import { useThemeContext } from '@dxos/react-ui';
import { useTextEditor } from '@dxos/react-ui-editor';
import { createBasicExtensions, createDataExtensions, createThemeExtensions } from '@dxos/ui-editor';

import { type Node } from '../../types';

export const RowEditor = ({
  node,
  readOnly = true,
  testId,
}: {
  node: Node;
  readOnly?: boolean;
  testId?: string;
}) => {
  const { themeMode } = useThemeContext();
  const text = node.text?.target;
  const { parentRef } = useTextEditor(
    () => ({
      id: node.id,
      initialValue: text?.content ?? '',
      extensions: text
        ? [
            createDataExtensions({ id: node.id, text: Doc.createAccessor(text, ['content']) }),
            createBasicExtensions({ readOnly }),
            createThemeExtensions({ themeMode }),
          ]
        : [createBasicExtensions({ readOnly: true })],
    }),
    [node.id, text, themeMode, readOnly],
  );
  // The caller owns the test id: rows tag `bramble-node-name`; the header leaves the
  // inner editor untagged (its `bramble-header` wrapper is the region target) so the two
  // never collide in findAllByTestId or in the visual-region selectors.
  return <div data-testid={testId} ref={parentRef} />;
};
