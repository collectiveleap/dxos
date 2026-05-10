# Fix MCP Connection Failure Crashing AI Requests

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent MCP server connection failures from crashing the entire AI request — failed connections should be logged and skipped gracefully.

**Architecture:** Change `connectWithFallback` to use `Effect.fail` (failure channel) instead of `Effect.die` (defect channel) for non-405 errors. Update the call site in `session.ts` to match. This is a two-file, three-line fix with a new test.

**Tech Stack:** Effect-TS, @modelcontextprotocol/sdk, vitest

---

### Task 0: Set up worktree

**Step 1: Create worktree and branch**

```bash
cd /mnt/utm/dxos
git worktree add .claude/worktrees/fix-mcp-defect -b claude/fix-mcp-defect
```

**Step 2: Verify worktree**

```bash
cd /mnt/utm/dxos/.claude/worktrees/fix-mcp-defect
git branch --show-current
```

Expected: `claude/fix-mcp-defect`

---

### Task 1: Write failing test (RED)

**Files:**
- Test: `packages/core/mcp-client/src/McpToolkit.test.ts`

**Step 1: Write the failing test**

Add this test to `McpToolkit.test.ts` inside a new `describe` block:

```typescript
describe('McpToolkit.make', () => {
  it('produces a failure (not a defect) when the server is unreachable', async () => {
    const result = await Effect.runPromise(
      McpToolkit.make({
        url: 'http://127.0.0.1:1/unreachable',
        kind: 'http',
      }).pipe(Effect.either),
    );
    expect(result._tag).toBe('Left');
  });
});
```

Add `expect` to the existing `@effect/vitest` import (it re-exports vitest's `expect`). Add `* as Either from 'effect/Either'` if not already imported.

**Step 2: Run test to verify it fails**

```bash
moon run mcp-client:test -- src/McpToolkit.test.ts -t "produces a failure"
```

Expected: FAIL — the test will throw an unhandled defect (`FiberFailure`) instead of returning `Left`, because `Effect.die` bypasses `Effect.either`.

**Step 3: Commit the failing test**

```bash
git add packages/core/mcp-client/src/McpToolkit.test.ts
git commit -m "test(mcp-client): RED - failing test for unreachable MCP server defect"
```

---

### Task 2: Fix McpToolkit.ts (GREEN)

**Files:**
- Modify: `packages/core/mcp-client/src/McpToolkit.ts:108`

**Step 1: Change `Effect.die` to `Effect.fail`**

In `connectWithFallback`, line 108, change:

```typescript
    return yield* Effect.die(primary.left);
```

to:

```typescript
    return yield* Effect.fail(primary.left);
```

This is the only change in this file. The return type of `connectWithFallback` changes from `Effect<Client, never, never>` to `Effect<Client, UnknownException, never>`, which propagates up through `make`.

**Step 2: Run the test to verify it passes**

```bash
moon run mcp-client:test -- src/McpToolkit.test.ts -t "produces a failure"
```

Expected: PASS — `Effect.either` now catches the failure and returns `Left`.

**Step 3: Commit**

```bash
git add packages/core/mcp-client/src/McpToolkit.ts
git commit -m "fix(mcp-client): use Effect.fail instead of Effect.die for MCP connection errors"
```

---

### Task 3: Update session.ts call site

**Files:**
- Modify: `packages/core/assistant/src/conversation/session.ts:294`

**Step 1: Change `Effect.tapDefect` to `Effect.tapError`**

In `connectMcpServers`, line 294, change:

```typescript
        Effect.tapDefect((error) => Effect.sync(() => log.warn('Failed to connect to MCP server', { error }))),
```

to:

```typescript
        Effect.tapError((error) => Effect.sync(() => log.warn('Failed to connect to MCP server', { error }))),
```

**Step 2: Build both packages to verify no type errors**

```bash
moon run mcp-client:build
moon run assistant:build
```

Expected: Both pass with no errors.

**Step 3: Run mcp-client tests**

```bash
moon run mcp-client:test
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/core/assistant/src/conversation/session.ts
git commit -m "fix(assistant): use tapError for MCP connection failures now in failure channel"
```

---

### Task 4: Lint and final verification

**Step 1: Run linter with fix**

```bash
moon run mcp-client:lint -- --fix
moon run assistant:lint -- --fix
```

Expected: No errors (or auto-fixed).

**Step 2: Run full test suites for both packages**

```bash
moon run mcp-client:test
moon run assistant:test
```

Expected: All pass.

**Step 3: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "chore: lint fixes"
```

(Skip if no changes.)
