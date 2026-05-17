//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload: client-side helpers for the drop-a-PDF-to-create-a-Node
// flow. Lives entirely above @dxos/echo per R-No-Echo-Changes — uses the
// public query/Filter API for dedup lookups and the F-DAG createEdge
// primitive for drop-site wiring.
//
// 2026-05-16: switched from inline `Bramble.Node.attachment` struct to
// the F-Supertag wrap pattern around plugin-wnfs's canonical
// `Wnfs.File` (typename `org.dxos.type.file`). The FileUploader
// capability (plugin-wnfs's WNFS implementation) creates and adds the
// Wnfs.File for us as part of the upload; Bramble locates it by `cid`
// post-upload and find-or-creates a Bramble.Node wrapper carrying the
// file as a supertag Ref. We treat Wnfs.File as an opaque ECHO object
// identified by its typename string to avoid a compile-time dependency
// on `@dxos/plugin-wnfs`.

import { Filter, Obj } from '@dxos/echo';

import { createEdge, findEdge } from '../Node/edges';

import { Bramble } from '#types';

// Stable typename of plugin-wnfs's File ECHO type. Avoids a hard
// import of `@dxos/plugin-wnfs` (cross-plugin compile coupling); the
// typename is part of the WNFS plugin's public contract and changes
// would be a coordinated upgrade either way.
export const WNFS_FILE_TYPENAME = 'org.dxos.type.file';

// True when the given ECHO object is a Wnfs.File representing a PDF —
// either by explicit mime type or by `.pdf` filename suffix (covers
// storage backends that drop the original mime type).
export const isPdfFile = (file: any | undefined): boolean => {
  if (!file) {
    return false;
  }
  if (file.type === 'application/pdf') {
    return true;
  }
  return ((file.name ?? '') as string).toLowerCase().endsWith('.pdf');
};

// Find an existing Wnfs.File in `db` whose content-addressed `cid`
// matches. Returns the FIRST match deterministically (lowest id wins)
// so concurrent uploads of the same bytes converge on the same
// canonical file instance.
export const findWnfsFileByCid = (db: any, cid: string): any | undefined => {
  if (!db || !cid) {
    return undefined;
  }
  const results = (db.query(Filter.typename(WNFS_FILE_TYPENAME)).runSync() ?? []) as Array<{
    object: any;
  }>;
  const matches = results
    .map((item) => (item as any).object ?? item)
    .filter((file: any) => file?.cid === cid)
    .sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
  return matches[0];
};

// Find the Bramble.Node in `db` whose `supertags` array contains a Ref
// to the given Wnfs.File. Returns the FIRST match deterministically
// (lowest id wins) — this is the wrapper-Node uniqueness invariant per
// F-Supertag.uniqueness extended to file wrappers.
export const findBrambleNodeWrappingFile = (
  db: any,
  wnfsFile: any,
): Bramble.Node | undefined => {
  if (!db || !wnfsFile) {
    return undefined;
  }
  const fileId = (wnfsFile as any).id;
  if (!fileId) {
    return undefined;
  }
  const results = (db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? []) as Array<{
    object: Bramble.Node;
  }>;
  const matches = results
    .map((item) => (item as any).object ?? item)
    .filter((node: any) => {
      const supertags = (node?.supertags ?? []) as readonly any[];
      return supertags.some((ref) => ref?.target && (ref.target as any).id === fileId);
    })
    .sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
  return matches[0];
};

// Return the FIRST supertag Ref's target that is a Wnfs.File, if any.
// Used by the chip-rendering site to detect whether a Bramble bullet
// wraps a file (and to pull the file metadata for rendering).
export const findFileSupertag = (node: Bramble.Node | undefined): any | undefined => {
  if (!node) {
    return undefined;
  }
  const supertags = ((node as any).supertags ?? []) as readonly any[];
  for (const ref of supertags) {
    const target = ref?.target;
    if (target && Obj.getTypename(target) === WNFS_FILE_TYPENAME) {
      return target;
    }
  }
  return undefined;
};

// Attach `child` to `parent` as a structural successor (creates an Edge
// per F-DAG). If an edge already exists, the call is a no-op — matches
// `createEdge`'s idempotence story so re-dropping the same PDF under
// the same parent does not pile up duplicate edges.
export const attachAsChild = (db: any, parent: Bramble.Node, child: Bramble.Node): void => {
  if (!db || !parent || !child) {
    return;
  }
  if (findEdge(db, parent, child)) {
    return;
  }
  createEdge(db, parent, child);
};

// Result of `ensurePdfBrambleNode` — the caller routes `node` through
// `attachAsChild` to wire it into the drop site.
export type EnsurePdfNodeResult = {
  // The Bramble.Node wrapping the Wnfs.File (either freshly created OR
  // the pre-existing one found via dedup).
  node: Bramble.Node;
  // The Wnfs.File that `node` wraps.
  wnfsFile: any;
  // True when the bytes hashed to an already-existing Wnfs.File (and
  // a wrapper Bramble.Node already exists for it) — surfaces in the UI
  // as a "linked existing" affordance, NOT as a created-fresh
  // confirmation.
  deduped: boolean;
};

// Upload a file via the FileUploader capability, then find-or-create a
// Bramble.Node that wraps the resulting Wnfs.File via the F-Supertag
// pattern. The FileUploader's contract (plugin-wnfs's WNFS
// implementation today) already creates the Wnfs.File and `AddObject`s
// it; Bramble locates the just-created instance by `cid` and wraps it.
//
// Doesn't wire the result into the drop site — the caller decides which
// parent to attach the result under (drop-site bullet vs page node) and
// calls `attachAsChild`. Splitting these keeps the upload-side logic
// pure of any rendering decisions.
export const ensurePdfBrambleNode = async ({
  db,
  file,
  uploader,
}: {
  db: any;
  file: File;
  // The FileUploader capability — returns the uploaded file's metadata
  // (including a content-addressed `cid`). Returned info is allowed to
  // be partially undefined; we treat a missing `cid` as a failure.
  uploader: (
    db: any,
    file: File,
  ) => Promise<{ url?: string; name?: string; type?: string; cid?: string } | undefined>;
}): Promise<EnsurePdfNodeResult | undefined> => {
  const info = await uploader(db, file);
  if (!info?.cid) {
    return undefined;
  }

  // The FileUploader (WNFS implementation) has already AddObject'd the
  // Wnfs.File — locate it by cid. Same-bytes-twice resolves to the
  // same Wnfs.File by construction (cid is content-addressed), so
  // re-uploads always find the canonical existing instance.
  const wnfsFile = findWnfsFileByCid(db, info.cid);
  if (!wnfsFile) {
    return undefined;
  }

  // Find-or-create the Bramble.Node wrapper. F-Supertag.uniqueness
  // extended: at most one Bramble.Node in the space carries a Ref to
  // this Wnfs.File in its supertags. The sort-by-id deterministic
  // tie-break in `findBrambleNodeWrappingFile` matches that invariant.
  const existing = findBrambleNodeWrappingFile(db, wnfsFile);
  if (existing) {
    return { node: existing, wnfsFile, deduped: true };
  }

  // F-PDF-Upload.drop-seeds-content-with-filename: the wrapping
  // Node's `content` is a copy of the dropped file's name so the
  // bullet displays the filename as editable text on creation.
  // The user can rename it like any other bullet; the file
  // association (the supertag Ref to the Wnfs.File) is unchanged
  // by rename, and a future drop of the same bytes still finds
  // the existing wrapper via the cid-based dedup path.
  const filename = (file.name ?? '').length > 0 ? file.name : 'PDF';
  const wrapper = Bramble.makeNode({
    content: [{ kind: 'text', text: filename }],
    supertags: [db.makeRef(Obj.getDXN(wnfsFile))],
  });
  db.add(wrapper);
  return { node: wrapper, wnfsFile, deduped: false };
};

// Derive a user-visible filename for a Wnfs.File. Falls back to "file"
// when the file has no `name` (legacy / unusual storage paths).
export const getFileLabel = (file: any | undefined): string => {
  if (!file) {
    return '';
  }
  const name = ((file.name ?? '') as string).trim();
  return name.length > 0 ? name : 'file';
};
