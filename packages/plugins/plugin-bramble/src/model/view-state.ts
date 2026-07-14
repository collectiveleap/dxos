//
// Copyright 2026 DXOS.org
//

// Local, per-user outline view-state — NOT substrate (design §2). Collapse and zoom
// change only what the current viewer sees; they write no Node or Edge.
export type ViewState = {
  collapsed: ReadonlySet<string>;
  zoomRootId: string | null;
  /** Linked-edge ids whose inline secondary view is expanded (per mention occurrence). */
  expandedMentions: ReadonlySet<string>;
};

export const EMPTY_VIEW_STATE: ViewState = { collapsed: new Set(), zoomRootId: null, expandedMentions: new Set() };

export const toggleCollapsed = (state: ViewState, nodeId: string): ViewState => {
  const next = new Set(state.collapsed);
  next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
  return { ...state, collapsed: next };
};

// A zoomed-in Node is the view root, so it is shown expanded — drop it from `collapsed`.
export const zoomTo = (state: ViewState, nodeId: string): ViewState => {
  const next = new Set(state.collapsed);
  next.delete(nodeId);
  return { ...state, collapsed: next, zoomRootId: nodeId };
};

export const toggleExpandedMention = (state: ViewState, edgeId: string): ViewState => {
  const next = new Set(state.expandedMentions);
  next.has(edgeId) ? next.delete(edgeId) : next.add(edgeId);
  return { ...state, expandedMentions: next };
};

export const zoomOut = (state: ViewState): ViewState => ({ ...state, zoomRootId: null });

export const resolveZoomRoot = (rootId: string | null, subjectId: string): string => rootId ?? subjectId;
