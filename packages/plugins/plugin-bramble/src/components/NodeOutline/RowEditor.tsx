//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { Doc } from '@dxos/echo-doc';
import { useThemeContext } from '@dxos/react-ui';
import { useTextEditor } from '@dxos/react-ui-editor';
import { createBasicExtensions, createDataExtensions, createThemeExtensions } from '@dxos/ui-editor';
import { mx } from '@dxos/ui-theme';

import { type Node } from '../../types';

import './node-outline.css';

export const RowEditor = ({
  node,
  readOnly = true,
  testId,
  className,
}: {
  node: Node;
  readOnly?: boolean;
  testId?: string;
  /** Applied to the wrapper div; distinguishes header-scale vs. row-scale chrome (see node-outline.css). */
  className?: string;
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
  return <div data-testid={testId} className={mx(className)} ref={parentRef} />;
};
