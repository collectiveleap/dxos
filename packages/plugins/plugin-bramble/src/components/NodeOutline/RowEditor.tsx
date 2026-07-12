//
// Copyright 2026 DXOS.org
//

import React, { useEffect } from 'react';

import { Doc } from '@dxos/echo-doc';
import { useThemeContext } from '@dxos/react-ui';
import { useTextEditor } from '@dxos/react-ui-editor';
import { createBasicExtensions, createDataExtensions, createThemeExtensions } from '@dxos/ui-editor';
import { mx } from '@dxos/ui-theme';

import { useOutlineController } from './controller';
import { brambleGestures } from './gestures-extension';
import { type Node } from '../../types';

import './node-outline.css';

type RowEditorProps = {
  node: Node;
  readOnly?: boolean;
  testId?: string;
  /** Applied to the wrapper div; distinguishes header-scale vs. row-scale chrome (see node-outline.css). */
  className?: string;
};

export const RowEditor = ({ node, readOnly = false, testId, className }: RowEditorProps) => {
  const { themeMode } = useThemeContext();
  const controller = useOutlineController();
  const text = node.text?.target;
  const { parentRef, view } = useTextEditor(
    () => ({
      id: node.id,
      initialValue: text?.content ?? '',
      extensions: [
        ...(text
          ? [
              createDataExtensions({ id: node.id, text: Doc.createAccessor(text, ['content']) }),
              createBasicExtensions({ readOnly }),
              createThemeExtensions({ themeMode }),
            ]
          : [createBasicExtensions({ readOnly: true })]),
        ...(controller && !readOnly ? [brambleGestures(controller, node.id)] : []),
      ],
    }),
    [node.id, text, themeMode, readOnly, controller],
  );
  useEffect(() => (view && controller ? controller.register(node.id, view) : undefined), [view, controller, node.id]);
  // The caller owns the test id: rows tag `bramble-node-name`; the header leaves the
  // inner editor untagged (its `bramble-header` wrapper is the region target) so the two
  // never collide in findAllByTestId or in the visual-region selectors.
  return <div data-testid={testId} data-node-id={node.id} className={mx(className)} ref={parentRef} />;
};
