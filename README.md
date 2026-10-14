# MediaX Agent

Agent-facing tooling for [MediaX](https://github.com/csdog/mediax): CLI + Skill for Cursor / Claude (and similar), with an optional MCP layer later.

**Status:** skeleton only. Product commands are not implemented yet.

## Relationship to MediaX desktop

| Piece | Repository |
| --- | --- |
| Desktop app (accounts, compose, publish, future schedule/calendar) | [`csdog/mediax`](https://github.com/csdog/mediax) |
| Agent surface (this repo) | `csdog/mediax-agent` |

Agent features that create or change **schedules** wait until the desktop ships **multi-platform scheduling** and a **content calendar**. Until then this repo holds naming, docs, and layout only.

## Planned shape

- **CLI:** primary command `mediax`, alias `mx`
- **Skill:** install/sync into Cursor / Claude (and similar) from this repo
- **MCP:** thin wrapper over the same CLI / library — not a second protocol
- **Talk to desktop:** loopback HTTP on `127.0.0.1` + a local token file (not a cloud relay)

## Non-goals (for now)

- No working publish / schedule / draft APIs in this repository yet
- No monorepo merge with `csdog/mediax`
- No dependency on third-party cloud publishers for the MediaX control channel

## License

Private / unpublished until stated otherwise.
