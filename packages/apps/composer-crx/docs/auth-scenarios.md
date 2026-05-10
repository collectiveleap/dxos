# CRX Authorization: Scenarios and Options

How the Composer browser extension (CRX) authenticates with an MCP server running as an edge worker (or locally for dev).

## Premise

**All forward work on the CRX assumes MCP on edge as the transport.** The extension no longer delivers clips via same-origin DOM events into a Composer tab. Instead, the CRX calls an MCP server (edge worker in production, localhost in dev) which performs operations on the user's behalf. The Composer tab's role, if any, is as an **auth credential provider** — not as the delivery mechanism.

Today's `composer:clip` CustomEvent bridge (Scenario 0 below) is the baseline we are moving away from.

## Summary

There are eight wire-auth options spanning the security/convenience/capability space, plus five Composer-side structural modifiers that shift what any credential is allowed to do. The key insight: **picking the Composer-side posture first (especially inbox quarantine) dramatically simplifies the wire-auth choice**, because a structurally-narrow write target makes even simple auth defensible.

The scenarios below map three product decisions to a concrete recommendation. The detailed options and modifiers that underpin them are in the appendix.

| | Scenario 0 | Scenario 1 | Scenario 2 | Scenario 3 | Scenario 4 |
|---|---|---|---|---|---|
| Transport | DOM bridge | MCP | MCP | MCP | MCP |
| Write target | workspace | workspace | workspace | inbox | inbox |
| Auth credential source | same-origin (implicit) | from-tab | from-tab | from-tab | from-setup (one-time) |
| Timeline | now (exists today) | now (dev) | ship | ship | ship |
| Auth mechanism | None (ambient authority) | None (localhost) or tab-issued token | Per-op macaroon + user confirm | Session token, silent, inbox-scoped | OAuth 2.0 + PKCE, inbox-scoped |
| Friction per clip | none | none | click in Composer | none (batch review later) | none (batch review later) |
| Extension compromise | full workspace write | full workspace write | spam prompts, can't write | inbox spam only | inbox spam only |
| Composer build | zero | low (MCP server + tools) | moderate-high | moderate | high |
| Reusable for other clients | no | yes (MCP tools defined) | no | no | yes |

**Likely path:** Scenario 0 (today) → Scenario 1 (MCP plumbing, dev) → Scenario 3 (when shipping) → Scenario 4 (if headless needed).

---

## Product Questions

The auth choice depends on three product decisions. All scenarios assume MCP as the transport — the questions determine **what the credential protects** and **where it comes from**.

**Q1 — What can the extension write?**

- `inbox` — drops `IncomingClip` records into a quarantine surface; user promotes to canonical objects in Composer later (requires P1 + P3 modifiers)
- `workspace` — creates canonical objects (Person, Organization) directly in a shared space

**Q2 — Where does the CRX get its MCP credential?**

- `from-tab` — CRX obtains auth material from an open Composer tab at runtime (tab is auth provider, not transport)
- `from-setup` — CRX obtained auth during a one-time pairing/OAuth flow; Composer tab not needed at runtime
- `none` — no auth (localhost dev, trusted network)

**Q3 — When does this ship?**

- `now` — dev/dogfood; harden later; unblock CRX development today
- `ship` — production-grade; needs revocation, abuse-resistance, real threat model

---

## Scenarios

### Scenario 0: workspace, DOM bridge, now (today's baseline)

**Transport:** No MCP. CRX sends clips via `composer:clip` CustomEvent through an open Composer tab. This is what exists today.

**Composer builds:** Nothing new. The current `plugin-crx-bridge` already does this.

**Security posture:** Same-origin ambient authority. Any script in the page could fake a clip. Acceptable for dev/dogfood because the audience is the team.

**What you give up:** Scoping, revocation, headless, defense-in-depth. Any collaborator in the space sees objects the extension creates with no audit trail distinguishing them from manual creation.

**Status:** This is where we are now. All scenarios below move to MCP.

### Scenario 1: workspace, MCP, credential from tab, now

**Recommendation:** CRX obtains a credential from an open Composer tab (challenge → tab signs a token, or simply reads a session value), then calls an MCP server (localhost in dev, edge in prod) with that credential. No user confirmation per clip — dev audience only.

**Composer builds:**

- MCP server (Streamable HTTP transport) with tool definitions: `clip_to_object`, `list_spaces`, possibly `query`
- Credential-vending endpoint in the Composer page (content script or page-level hook that responds to the CRX's auth request)
- CRX options: MCP endpoint URL field

**Security posture:** Low — same trust level as Scenario 0 but over a different transport. The credential is derived from the Composer session; in dev mode, validation on the MCP server can be relaxed or skipped. Acceptable because the audience is the team.

**What you gain over Scenario 0:**

- Defines the MCP tool interface that all later scenarios reuse — `clip_to_object` is the same tool whether auth is "dev token" (now) or "OAuth" (later)
- Establishes the credential-from-tab flow that Scenarios 2 and 3 harden
- Exercises the real transport (HTTP to MCP server) that production uses
- Other dev tools (CLI, scripts, tests) can call the same MCP endpoint
- CRX → MCP client code carries forward unchanged; only the auth strictness changes

**What you give up:** No real security; credential is a formality in dev. Any process that can reach the MCP server can write. Tab still needs to be open (for credential vending, not for delivery).

**When to leave this behind:** When you ship to users. The tool definitions, MCP client code, and transport path carry forward; you add real validation and potentially inbox quarantine.

### Scenario 2: workspace, MCP, credential from tab, ship

**Recommendation:** Tab-signs-a-per-operation-token (macaroon variant) with user confirmation. Each clip: CRX sends challenge + payload hash to Composer tab, Composer shows a confirmation prompt ("Create Person 'Jane Doe' in Space X?"), user approves, Composer signs a single-use payload-bound token, CRX hands it to Edge MCP, Edge verifies and writes.

**Composer builds:**

- In-page signing endpoint (receives challenge, presents confirmation UI, signs token)
- Edge MCP verification (HALO public key, caveat checking)
- Confirmation UX (toast or inline prompt per clip)

**Security posture:** High. No long-lived credential in the extension. Per-operation user gesture in trusted UI. Payload-bound token means a stolen in-flight token can only replay the exact operation it was minted for (and it's single-use). Extension compromise = can spam confirmation prompts, but can't write without user click.

**What you give up:** Frictionful — every clip requires a click in Composer, not just in the extension. Users who clip frequently may find this annoying. Headless is impossible. Build cost is moderate-high.

**Tension to resolve:** "workspace + ship" without inbox quarantine means a compromised-or-buggy extension that bypasses confirmation can write garbage into shared spaces. Consider whether the confirmation prompt is load-bearing for safety or whether P1 (inbox) should be added as a structural backstop.

### Scenario 3: inbox, MCP, credential from tab, ship

**Recommendation:** Tab-signs-a-session-token (challenge, Composer signs a scoped token, silent). CRX generates challenge, sends to Composer tab, Composer signs a token scoped to `inbox-write` only (TTL = hours or until tab closes), CRX uses that token for subsequent Edge MCP calls within the session. No per-clip user confirmation needed.

**Composer builds:**

- Inbox quarantine surface (P1) + `IncomingClip` schema restriction (P3)
- Ingest/promote UI ("Review 3 clips, move to Space X as Person")
- In-page signing endpoint (silent — no per-op prompt needed because writes are structurally harmless)
- Edge MCP verification (signature + scope check: only `inbox-write` accepted)

**Security posture:** High, with low friction. Silent signing is acceptable because the write target is quarantined — worst case is inbox spam, which the user reviews and discards. Token is time-limited, scoped to a single verb (`inbox-write`), and revocable. Extension compromise = fills inbox with junk; cannot touch canonical objects or shared spaces.

**What you give up:** User must promote clips manually in Composer (extra step vs. direct write). Requires a Composer tab open. Build cost is in the inbox/ingest UI more than the auth.

**Why this might be the sweet spot:** Auth is simple (silent, session-scoped), security is structural (inbox quarantine does the heavy lifting), and the UX cost (review + promote) doubles as a feature — users get to preview/edit before objects enter their workspace.

### Scenario 4: inbox, MCP, credential from setup, ship

**Recommendation:** OAuth 2.0 + PKCE (Option 2), scoped to `inbox-write` only.

**Auth flow:** CRX clicks "Connect", launches web auth flow to Composer's consent page, user approves "Allow Composer Extension to add clips to your inbox", CRX receives access + refresh tokens, sends `Authorization: Bearer` directly to Edge MCP. No Composer tab needed at runtime.

**Composer builds:**

- OAuth IdP surface (auth endpoint, token endpoint, revocation, JWKS or introspection)
- Inbox quarantine surface (P1) + `IncomingClip` schema restriction (P3)
- Ingest/promote UI
- Edge MCP token validation (JWT signature check or introspection call)

**Security posture:** High. Standard web-platform auth with server-side revocation. Token scope is structurally narrow — only `inbox-write` — so a stolen refresh token's blast radius is inbox spam. No canonical object writes reachable via this credential at all.

**What you give up:** Build cost is the highest — real OAuth IdP is non-trivial. But you get a credential model that every future integration (CLI, mobile app, third-party plugins, MCP clients) can reuse. The inbox quarantine means you don't need to over-invest in token security because the stakes per-token are bounded.

---

## Observations

- **Scenario 0 → 1 → 3 is the likely path.** Start with today's DOM bridge, move to MCP with tab-issued credential (defines tools, exercises real transport, dev-only), then add inbox quarantine + real token validation when shipping. Auth stays simple because inbox does the security work.
- **Scenario 1 is the key stepping stone.** It defines the MCP tool contract (`clip_to_object`, `list_spaces`) that every later scenario reuses unchanged. The CRX MCP client code, the tool schemas, and the credential-from-tab flow all carry forward — only the validation strictness and write target change.
- **Scenario 3 is the sweet spot if "credential from tab" is acceptable.** Lowest build cost of the shipping options; security is structural, not ceremonial; auth is lightweight.
- **Scenario 4 is Scenario 3 minus the tab dependency.** The delta is the OAuth IdP — real cost, but you get a credential model that serves every future client, not just the CRX.
- **Scenario 2 is the outlier.** Per-op user confirmation is high-security but high-friction. Worth it only if canonical workspace writes from the extension are a hard product requirement AND inbox quarantine is rejected.

---

## Appendix A: Wire-Auth Options

Eight options spanning the design space, from simplest to most DXOS-native.

### Option 1 — Static bearer token, manually pasted

- **Handshake:** Composer mints an opaque token via a settings UI; user pastes it into the CRX options page; CRX sends `Authorization: Bearer` on each call; Edge validates against its store.
- **Extension compromise:** Full impersonation within token scope until revoked. `chrome.storage.sync` widens the steal surface across Chrome profiles.
- **Edge compromise:** Acts as every paired user — high-value confused deputy.
- **Convenience:** Trivial to ship. Manual paste. No rotation/expiry UI.
- **Capability ceiling:** Full — headless, background, scheduled.
- **Composer build cost:** Low.

### Option 2 — OAuth 2.0 + PKCE (Composer as authorization server)

- **Handshake:** CRX launches a web-auth flow; user consents in Composer; auth code; CRX exchanges with PKCE verifier; access + refresh tokens; Bearer on each call; auto-refresh on expiry.
- **Extension compromise:** Refresh-token theft, but short-lived, rotated, and instantly revocable server-side.
- **Edge compromise:** Same as Option 1.
- **Convenience:** High. One-click connect, familiar UX, automatic rotation.
- **Capability ceiling:** Full.
- **Composer build cost:** Moderate — proper IdP surface (auth endpoint, token endpoint, revocation, JWKS or introspection).

### Option 3 — Pair-once binding + per-request signing

- **Handshake:** CRX generates a keypair; Composer issues a HALO-signed attestation binding `{pubkey, scopes, expiry}`; CRX signs each request with the paired private key plus a nonce; Edge verifies signature against the attestation.
- **Extension compromise:** Paired key only — not full HALO. Replay risk if nonce/timestamp discipline is weak.
- **Edge compromise:** Cannot forge new signatures.
- **Convenience:** Moderate. One pairing step; more moving parts to build correctly.
- **Capability ceiling:** Full.
- **Composer build cost:** Moderate-high — pairing protocol, attestation format, replay-safe wire envelope.

### Option 4 — CRX as a HALO device

- **Handshake:** User triggers "Add device" in Composer; invitation code; CRX redeems and joins HALO; CRX signs ECHO mutations directly with its device key; Edge MCP is a thin relay.
- **Extension compromise:** Full HALO access across every space the user is in — largest blast radius.
- **Edge compromise:** Minimal — relay only.
- **Convenience:** Low. MV3 service-worker lifecycle is hostile to a real HALO client; usually requires a hosted vault.
- **Capability ceiling:** Highest in principle, brittle in practice.
- **Composer build cost:** Low for auth (reuses existing invitation flow); high for runtime (vault, lifecycle resilience).

### Option 5 — Composer-tab broker (no extension credential)

- **Handshake:** CRX has no credentials; popup or background sends request to a content script in an open Composer tab; Composer makes the authenticated call using its own session; result returns through the same chain.
- **Extension compromise:** Nothing to steal; but any same-origin script in the Composer page can pose as the CRX.
- **Edge compromise:** Same as Composer's normal session — not extension-specific.
- **Convenience:** Lowest at runtime (requires open tab); highest at build (almost nothing new).
- **Capability ceiling:** Low — no headless, no background.
- **Composer build cost:** Trivial.

### Option 6 — One-shot capability tokens (macaroon-style)

- **Handshake:** Per operation, CRX requests a token from Composer with inline caveats (tool, space, payload-hash, TTL ~60s, single-use); Composer signs with HALO key after user approval; CRX hands token + payload to Edge MCP; Edge verifies signature + caveats.
- **Extension compromise:** In-flight token theft = at most one already-shaped operation, expiring in seconds.
- **Edge compromise:** Cannot mint or replay; every call carries its own narrow warrant.
- **Convenience:** Moderate. Per-operation round-trip; Composer must be reachable per call.
- **Capability ceiling:** Medium — no background work between user sessions.
- **Composer build cost:** High — token-mint endpoint, caveat language, signature verification on Edge.

### Option 7 — Push-to-Composer approval per action

- **Handshake:** CRX submits an unsigned proposal to Composer over a notification channel; Composer prompts the user with a preview; on approval Composer signs and submits to Edge MCP using its own session; CRX learns approved/rejected.
- **Extension compromise:** Cannot complete any write without a real user gesture in trusted UI; can only generate spammy proposals.
- **Edge compromise:** Same as Composer's normal session.
- **Convenience:** Low for high-volume work; appropriate for low-frequency user-initiated work.
- **Capability ceiling:** Low — every write requires a click.
- **Composer build cost:** Moderate — proposal queue, prompt UI, signing pipeline.

### Option 8 — Hardware-bound passkey / WebAuthn signing

- **Handshake:** At pairing, CRX provisions a passkey scoped to Composer's origin (private key in TPM/Secure Enclave). Every MCP write requires a fresh `navigator.credentials.get()` assertion (Touch ID / Windows Hello / security key tap). Edge verifies the assertion.
- **Extension compromise:** Key unextractable; phishing-resistant; replay-resistant.
- **Edge compromise:** Assertions are challenge-bound — cannot replay.
- **Convenience:** Low — gesture per write; rate-limited by user patience.
- **Capability ceiling:** Low — every action gated by user presence.
- **Composer build cost:** Moderate — relying-party endpoints, passkey lifecycle UX.

---

## Appendix B: Composer-Side Modifiers

Structural changes to Composer that reduce what any wire-auth credential can do, independent of the auth mechanism chosen. These shift the security/capability frontier without changing the wire protocol.

- **P1 (Safe inbox):** Inbound payloads land in an isolated ECHO inbox; user explicitly promotes them into a real workspace. Reduces "compromised credential" damage to "fills the inbox."
- **P2 (Capability-tiered spaces):** Extension is only invited to a "device scratch" space; cannot reach user workspaces by construction. Scope enforced by ECHO credentials, not token caveats.
- **P3 (Schema-restricted ingest):** Extension can only create `IncomingClip`-like records, never canonical types (Person, Organization). Schema queries don't see clipped data until the user converts it in-app.
- **P4 (Identity quarantine):** Inbound writes attributed to a per-extension HALO sub-identity, badged in the UI, revocable wholesale. Primary identity unaffected.
- **P5 (Reversible-window telemetry):** Soft-delete + per-batch notifications turn silent write attacks loud and recoverable.

---

## Appendix C: Combination Notes

How the wire-auth options and Composer-side modifiers interact:

- **P1 + P3 collapses the wire-auth threat model.** Once Edge MCP can only "drop an `IncomingClip` into my inbox," even Option 1 (static bearer) stops being a security problem — the security-sensitive verbs (canonical writes, space mutations) require a user gesture in trusted Composer UI regardless of wire auth.
- **Headless / background work requires Options 1-4** on the wire. Incompatible with Options 5, 7, and 8 in practice. If the product never needs Edge MCP to act between user sessions, the high-security/low-capability quadrant is cheap.
- **Option 4 is the only option whose blast radius isn't bounded by Composer-side modifiers.** A HALO device's authority predates ingest gating. If Option 4 is on the table it should be paired with hosted-vault work, not extension-side keystore alone.
- **For dev, Option 5 is the simplest fallback** regardless of which production wire choice is picked.
- **Suggested framing for decision-making:** decide the Composer-side posture (which P's are in scope) first, then pick the wire option that meets the residual requirement at the lowest build cost.

---

## Appendix D: Prior Art — Readwise

The Readwise browser extension uses cookie piggybacking: it holds `cookies` permission for `*.readwise.io`, reads the user's session cookies directly via `chrome.cookies` API, and uses them on API calls. No separate pairing, no token generation, no consent screen.

This works for Readwise because:
- Single-user data model (my highlights)
- Low-value writes (highlight text)
- No collaboration / multi-tenant spaces
- Every operation is trivially undoable

The CRX / Composer case differs on every axis (multi-tenant, shared spaces, canonical objects visible to collaborators, real trust boundaries). Cookie piggybacking maps to "Option 5 minus the tab-broker guardrail" and is viable for the CRX only when combined with strong Composer-side modifiers (P1 + P3).

The "challenge from CRX to active tab which signs a token" proposal is explicitly one step better than Readwise: derive a credential from the session, but make it a separate artifact that can be scoped, time-limited, and revoked independently.
