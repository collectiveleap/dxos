//
// Copyright 2026 DXOS.org
//

// F-PDF-Upload: client-side helpers for the drop-a-PDF-to-create-a-Node flow.
// Lives entirely above @dxos/echo per R-No-Echo-Changes — uses the public
// query/Filter API for dedup lookups and the F-DAG createEdge primitive for
// drop-site wiring.

import { Filter } from '@dxos/echo';

import { createEdge, findEdge } from '../Node/edges';

import { Bramble } from '#types';

// Compute the SHA-256 of the given bytes as a lowercase hex string. Uses
// WebCrypto.subtle which is available in every Composer target (browser,
// secure contexts). The digest is the dedup key — same bytes always hash
// to the same string regardless of filename or MIME type.
export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  // SubtleCrypto.digest's BufferSource type is awkward in TS 5.6+
  // (Uint8Array<ArrayBufferLike> doesn't satisfy ArrayBufferView<
  // ArrayBuffer> directly). The runtime accepts a Uint8Array fine;
  // the cast is the path of least friction here.
  const buffer = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

// True when the attachment is a PDF — either by explicit mime type or by
// the URL's `.pdf` suffix (covers wnfs:// URLs whose returned info may not
// preserve the original mime type in every storage backend).
export const isPdfAttachment = (
  attachment: Bramble.Node['attachment'] | undefined,
): boolean => {
  if (!attachment) {
    return false;
  }
  if (attachment.mimeType === 'application/pdf') {
    return true;
  }
  return (attachment.url ?? '').toLowerCase().endsWith('.pdf');
};

// Find the Bramble.Node in `db` whose attachment carries the given
// SHA-256 hash, if any. Returns the FIRST match deterministically (lower
// id wins) so concurrent uploads of the same file across panes converge
// on the same canonical Node.
export const findNodeByHash = (db: any, sha256: string): Bramble.Node | undefined => {
  if (!db || !sha256) {
    return undefined;
  }
  const results = (db.query(Filter.typename(Bramble.Node.typename)).runSync() ?? []) as Array<{
    object: Bramble.Node;
  }>;
  const matches = results
    .map((item) => (item as any).object ?? item)
    .filter((node: Bramble.Node) => (node as any)?.attachment?.sha256 === sha256)
    .sort((a: Bramble.Node, b: Bramble.Node) => ((a as any).id < (b as any).id ? -1 : 1));
  return matches[0];
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

// Result of `uploadPdfWithDedup` — the caller routes this through
// `attachAsChild` (or the F-DAG primitive of its choice) to wire the
// returned Node into the drop site.
export type PdfUploadResult = {
  // The Bramble.Node carrying the file's attachment (either newly
  // created OR the pre-existing one returned via dedup).
  node: Bramble.Node;
  // True when the bytes hashed to an already-existing Node and no upload
  // ran — surfaces in the UI as a "linked existing" affordance, NOT as
  // a created-fresh confirmation.
  deduped: boolean;
};

// Hash, upload (if new), and find-or-create a Bramble.Node carrying the
// file's attachment. The caller passes the live FileUploader function
// (typically resolved via the `AppCapabilities.FileUploader` capability
// — plugin-wnfs supplies the implementation today).
//
// Doesn't wire the result into the drop site — the caller decides which
// parent to attach the result under (drop-site bullet vs page node) and
// calls `attachAsChild`. Splitting these keeps the upload-side logic
// pure of any rendering decisions.
export const uploadPdfWithDedup = async ({
  db,
  file,
  uploader,
}: {
  db: any;
  file: File;
  // The FileUploader capability — returns the uploaded file's metadata
  // (including the persisted URL). Returned info is allowed to be
  // partially undefined; we treat a missing url as a failure.
  uploader: (db: any, file: File) => Promise<{ url?: string; name?: string; type?: string } | undefined>;
}): Promise<PdfUploadResult | undefined> => {
  // Snapshot the bytes once — File.arrayBuffer reads the file's
  // contents and we want to feed them to both the hasher and the
  // uploader without re-reading.
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const sha256 = await sha256Hex(bytes);

  // Dedup: if a Node already carries this hash, return it without
  // uploading. The dedup query runs against the LIVE db so concurrent
  // uploads of the same file across panes converge as soon as either
  // commits its create.
  const existing = findNodeByHash(db, sha256);
  if (existing) {
    return { node: existing, deduped: true };
  }

  // Fresh upload — push the bytes to file storage, then create the
  // Bramble.Node carrying the resulting URL + the dedup-key fields.
  const info = await uploader(db, file);
  if (!info?.url) {
    return undefined;
  }
  // F-PDF-Upload: do NOT set `Node.kind` — the existing literal
  // enum doesn't include `'file'` and the renderer keys off
  // `attachment.kind` + `attachment.mimeType` for the chip
  // (per F-PDF-Upload.chip-rendering). Adding a new `Node.kind`
  // value would propagate through tag/picker filters unnecessarily.
  const node = Bramble.makeNode({
    attachment: {
      kind: 'file',
      url: info.url,
      name: info.name ?? file.name,
      mimeType: info.type ?? file.type ?? undefined,
      sha256,
    },
  });
  // Add the Node first so subsequent dedup queries (e.g. a second
  // concurrent drop already in flight) find it.
  db.add(node);
  return { node, deduped: false };
};

// Convenience: derive a user-visible filename for an attachment that
// may have been created before F-PDF-Upload's name/mimeType fields
// were added. Falls back to the last URL segment when `name` is empty.
export const getAttachmentLabel = (
  attachment: Bramble.Node['attachment'] | undefined,
): string => {
  if (!attachment) {
    return '';
  }
  const name = (attachment.name ?? '').trim();
  if (name.length > 0) {
    return name;
  }
  const url = attachment.url ?? '';
  // Strip query/hash, then take the trailing path segment.
  const path = url.split(/[?#]/, 1)[0];
  const segments = path.split('/');
  return segments[segments.length - 1] || 'file';
};
