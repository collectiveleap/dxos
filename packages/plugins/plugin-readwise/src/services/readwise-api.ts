//
// Copyright 2026 DXOS.org
//

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import { proxyFetchLegacy } from '@dxos/edge-client/cors-proxy';

import { READWISE_API_BASE } from '../constants';
import { ReadwiseError } from '../errors';

import { ReadwiseCredentials } from './credentials';

//
// Wire schemas
//

const TagSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
});

const HighlightWireSchema = Schema.Struct({
  id: Schema.Number,
  text: Schema.String,
  note: Schema.String,
  location: Schema.NullOr(Schema.Number).pipe(Schema.optional),
  location_type: Schema.NullOr(Schema.String).pipe(Schema.optional),
  color: Schema.NullOr(Schema.String).pipe(Schema.optional),
  highlighted_at: Schema.NullOr(Schema.String).pipe(Schema.optional),
  updated_at: Schema.String,
  external_id: Schema.NullOr(Schema.String).pipe(Schema.optional),
  url: Schema.NullOr(Schema.String).pipe(Schema.optional),
  book_id: Schema.Number,
  tags: Schema.Array(TagSchema),
  readwise_url: Schema.NullOr(Schema.String).pipe(Schema.optional),
});

const DocumentWireSchema = Schema.Struct({
  user_book_id: Schema.Number,
  title: Schema.String,
  author: Schema.NullOr(Schema.String).pipe(Schema.optional),
  readable_title: Schema.NullOr(Schema.String).pipe(Schema.optional),
  source: Schema.NullOr(Schema.String).pipe(Schema.optional),
  cover_image_url: Schema.NullOr(Schema.String).pipe(Schema.optional),
  unique_url: Schema.NullOr(Schema.String).pipe(Schema.optional),
  summary: Schema.NullOr(Schema.String).pipe(Schema.optional),
  book_tags: Schema.Array(TagSchema),
  category: Schema.NullOr(Schema.String).pipe(Schema.optional),
  document_note: Schema.NullOr(Schema.String).pipe(Schema.optional),
  readwise_url: Schema.NullOr(Schema.String).pipe(Schema.optional),
  source_url: Schema.NullOr(Schema.String).pipe(Schema.optional),
  external_id: Schema.NullOr(Schema.String).pipe(Schema.optional),
  asin: Schema.NullOr(Schema.String).pipe(Schema.optional),
  highlights: Schema.Array(HighlightWireSchema),
});

const ExportResponseSchema = Schema.Struct({
  // `count` is always present on the real API but unused here — kept optional so
  // hand-built test/mock payloads aren't forced to carry a field nothing reads.
  count: Schema.Number.pipe(Schema.optional),
  nextPageCursor: Schema.NullOr(Schema.String).pipe(Schema.optional),
  results: Schema.Array(DocumentWireSchema),
});

const decodeExportResponse = Schema.decodeUnknown(ExportResponseSchema);

//
// Public types
//

/** A single Readwise highlight, flattened with its parent document's metadata. */
export interface Highlight {
  readonly readwiseId: string;
  readonly text: string;
  readonly note: string;
  readonly tags: readonly string[];
  readonly location: number | undefined;
  readonly url: string | undefined;
  readonly updated: string;
  readonly sourceTitle: string;
  readonly sourceAuthor: string | undefined;
  readonly sourceUrl: string | undefined;
  readonly sourceCategory: string | undefined;
  readonly sourceImage: string | undefined;
}

/** Result of a single (paginated) `listHighlightsSince` call. */
export interface ListHighlightsResult {
  readonly highlights: readonly Highlight[];
  readonly nextCursor: string | undefined;
}

//
// Transport — the injectable seam
//

/**
 * Injectable HTTP seam. Production wires this to the EDGE CORS proxy (browser
 * requests can't hit readwise.io directly); tests and Node-side sync jobs
 * bypass the proxy entirely via `TransportLive.direct` or a mock.
 */
export class Transport extends Context.Tag('@dxos/plugin-readwise/Transport')<
  Transport,
  {
    readonly fetch: (url: string, init?: RequestInit) => Effect.Effect<Response, ReadwiseError>;
  }
>() {}

/**
 * Wraps a promise-returning fetch call, mapping any thrown error (network
 * failure, abort, etc.) into a {@link ReadwiseError} — the transport must
 * never leak an untyped `Error` into the Effect error channel.
 */
const wrapFetch = (call: () => Promise<Response>): Effect.Effect<Response, ReadwiseError> =>
  Effect.tryPromise({
    try: call,
    catch: (cause) => new ReadwiseError({ message: 'Readwise transport request failed.', cause }),
  });

/** Transport layers — production wiring only; tests inject their own via `Layer.succeed(Transport, ...)`. */
export const TransportLive = {
  /**
   * Routes through the legacy open CORS proxy so browser contexts (which
   * can't hit readwise.io directly) can reach the API. The proxy remaps the
   * `Authorization` header to `X-Cors-Proxy-Authorization` before forwarding.
   */
  edgeProxy: Layer.succeed(Transport, {
    fetch: (url, init) => wrapFetch(() => proxyFetchLegacy(new URL(url), init)),
  }),

  /** Direct global `fetch` — used by Node-side sync jobs that aren't subject to browser CORS. */
  direct: Layer.succeed(Transport, {
    fetch: (url, init) => wrapFetch(() => fetch(url, init)),
  }),
};

//
// Mapping
//

/** Flattens one document's highlights, carrying parent document fields onto each. */
const flattenDocument = (document: Schema.Schema.Type<typeof DocumentWireSchema>): Highlight[] =>
  document.highlights.map((highlight) => ({
    readwiseId: String(highlight.id),
    text: highlight.text,
    note: highlight.note,
    tags: highlight.tags.map((tag) => tag.name),
    location: highlight.location ?? undefined,
    url: highlight.url ?? undefined,
    updated: highlight.updated_at,
    sourceTitle: document.title,
    sourceAuthor: document.author ?? undefined,
    sourceUrl: document.source_url ?? undefined,
    sourceCategory: document.category ?? undefined,
    sourceImage: document.cover_image_url ?? undefined,
  }));

//
// ReadwiseApi
//

/** Builds the `export` endpoint URL for a given cursor/page-cursor pair. */
const buildExportUrl = (params: { updatedAfter?: string; pageCursor?: string }): string => {
  const url = new URL(`${READWISE_API_BASE}/export/`);
  if (params.updatedAfter) {
    url.searchParams.set('updatedAfter', params.updatedAfter);
  }
  if (params.pageCursor) {
    url.searchParams.set('pageCursor', params.pageCursor);
  }
  return url.toString();
};

/** Fetches and decodes a single `export` page through the injected {@link Transport}. */
const fetchExportPage = (
  params: { updatedAfter?: string; pageCursor?: string },
): Effect.Effect<Schema.Schema.Type<typeof ExportResponseSchema>, ReadwiseError, Transport | ReadwiseCredentials> =>
  Effect.gen(function* () {
    const transport = yield* Transport;
    const { token } = yield* ReadwiseCredentials;
    const response = yield* transport.fetch(buildExportUrl(params), {
      headers: { Authorization: `Token ${token}` },
    });
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) => new ReadwiseError({ message: 'Failed to read Readwise response body.', cause }),
    });
    return yield* decodeExportResponse(json).pipe(
      Effect.mapError((cause) => new ReadwiseError({ message: 'Failed to decode Readwise export response.', cause })),
    );
  });

/**
 * Readwise REST client. `listHighlightsSince` walks every page of the
 * `export` endpoint starting at `cursor` (an ISO timestamp, or undefined for
 * "all time"), flattening documents into highlights.
 */
export class ReadwiseApi extends Context.Tag('@dxos/plugin-readwise/ReadwiseApi')<
  ReadwiseApi,
  {
    readonly listHighlightsSince: (
      cursor?: string,
    ) => Effect.Effect<ListHighlightsResult, ReadwiseError, Transport | ReadwiseCredentials>;
  }
>() {}

/** `ReadwiseApi` layer. The token is sourced from {@link ReadwiseCredentials} at call time. */
export const ReadwiseApiLayer: Layer.Layer<ReadwiseApi> = Layer.succeed(ReadwiseApi, {
  listHighlightsSince: (cursor) =>
    Effect.gen(function* () {
      const highlights: Highlight[] = [];
      let pageCursor: string | undefined;
      let nextCursor: string | undefined;
      do {
        const page = yield* fetchExportPage({ updatedAfter: cursor, pageCursor });
        for (const document of page.results) {
          highlights.push(...flattenDocument(document));
        }
        pageCursor = page.nextPageCursor ?? undefined;
        nextCursor = pageCursor;
      } while (pageCursor);
      return { highlights, nextCursor };
    }),
});
