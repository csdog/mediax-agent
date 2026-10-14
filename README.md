# MediaX Agent

Agent-facing tooling for [MediaX](https://github.com/csdog/mediax): CLI + Skill for Cursor / Claude (and similar), with an optional MCP layer later.

**Status:** early CLI scaffold. `doctor` works; publish/schedule commands are not implemented yet.

## Relationship to MediaX desktop

| Piece | Repository |
| --- | --- |
| Desktop app (accounts, compose, publish, future schedule/calendar) | [`csdog/mediax`](https://github.com/csdog/mediax) |
| Agent surface (this repo) | `csdog/mediax-agent` |

Agent features that create or change **schedules** wait until the desktop ships **multi-platform scheduling** and a **content calendar**. Until then this repo holds naming, docs, and layout only.

## Planned shape

- **CLI:** primary command `mediax`, alias `mx`
- **Skill:** maintained in-repo at `skills/mediax/`; sync with `mediax skill sync`
- **MCP:** thin wrapper over the same CLI / library — not a second protocol
- **Talk to desktop:** loopback HTTP on `127.0.0.1` + a local token file (not a cloud relay)

## Tech stack (decided)

| Layer | Choice |
| --- | --- |
| **Desktop control API** ([`csdog/mediax`](https://github.com/csdog/mediax)) | Electron main process: **Hono** + OpenAPI/Swagger (e.g. `@hono/zod-openapi`), bind `127.0.0.1` only |
| **This CLI** | **TypeScript** + **Bun compile** → single binary (`mediax` / `mx`); users need not install Node |
| **API client** | Generate from desktop OpenAPI with **`@openapi-codegen/typescript`** |
| **Contract flow** | Desktop owns/exports OpenAPI → this repo generates typed client → CLI/MCP call loopback |

Electron cannot use Bun as its main-process runtime; Bun is for this agent CLI only.

## Development

```bash
bun install
bun run doctor          # human summary (exit 1 until desktop control API exists)
bun run mediax doctor --json
bun run mediax skill show
bun run mediax skill sync   # → ~/.agents/skills/mediax
bun test
bun run build           # dist/mediax + dist/mx via Bun compile
```

`doctor` checks `~/.mediax/control.json` (or `MEDIAX_CONTROL_URL` + `MEDIAX_CONTROL_TOKEN`) and probes `GET {baseUrl}/health` with the bearer token. Desktop has not shipped that API yet, so “not ready” is expected.

### Skill

Source of truth: [`skills/mediax/`](skills/mediax/). Keep `SKILL.md` version in sync with meaningful CLI changes. After pull/upgrade:

```bash
mediax skill sync
```

## Non-goals (for now)

- No working publish / schedule / draft APIs in this repository yet
- No monorepo merge with `csdog/mediax`
- No dependency on third-party cloud publishers for the MediaX control channel

## License

Private / unpublished until stated otherwise.
