# @dxos/plugin-readwise

Triages Readwise highlights and notes into Composer. Pulls annotations from the
Readwise REST API, proposes an AI decomposition into comments/questions/to-dos,
and surfaces a human-gated triage `Kanban` for Steve to confirm, edit, or reject
each item. Confirmed items land as ordinary `Task`/`Message` objects tagged with
their intent and linked back to the source document.

See [`PLUGIN.mdl`](./PLUGIN.mdl) for the full specification and
`docs/superpowers/specs/2026-07-04-readwise-annotation-triage-design.md` for the
design background (Increment 1 of a larger arc).

## DXOS Resources

- [Website](https://dxos.org)
- [Developer Documentation](https://docs.dxos.org)
- Talk to us on [Discord](https://dxos.org/discord)

## Contributions

Your ideas, issues, and code are most welcome. Please take a look at our [community code of conduct](https://github.com/dxos/dxos/blob/main/CODE_OF_CONDUCT.md), the [issue guide](https://github.com/dxos/dxos/blob/main/CONTRIBUTING.md#submitting-issues), and the [PR contribution guide](https://github.com/dxos/dxos/blob/main/CONTRIBUTING.md#submitting-prs).

License: [FSL-1.1-Apache-2.0](./LICENSE) Copyright 2026 © DXOS
