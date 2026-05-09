# @dxos/plugin-blocks

Block-based outliner plugin. Each bullet is a first-class ECHO object with a stable id, structured content, optional supertags, and optional typed fields.

The schema is designed as a faithful Tana Paste import target: every shape Tana Paste can produce has a slot in `Block`, even if the corresponding rendering isn't shipped yet. This avoids data-model migrations as later increments fill in editor, ref, and tagging behaviour.

The existing [`@dxos/plugin-outliner`](../plugin-outliner) (markdown-blob outliner) is unaffected.
