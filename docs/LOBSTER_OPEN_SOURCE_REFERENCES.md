# Lobster Open-Source Reference Mapping

This document records how Lobster uses open-source architecture patterns without vendoring external code or adding dependencies.

## Reference Sources

- OpenClaw: `https://github.com/openclaw/openclaw`
- Letta: `https://github.com/letta-ai/letta`
- LangGraph: `https://github.com/langchain-ai/langgraph`
- Ankh Hermes: `https://github.com/EmrahAblak/Ankh`
- Hermes Studio: `https://github.com/evalstate/hermes`

## Adopted Patterns

### OpenClaw-Style Local Shell And Channel Boundary

Adopted:

- keep the product shell independent from the miniapp
- make the parent device the default channel
- treat QQ, WeChat, and watch devices as future official adapters
- keep channel adapters outside the core education runtime

Lobster implementation:

- `/lobster.html`
- `apps/web/src/app.js` route `#lobster`
- `src/lobster/lobster-onboarding.cjs`
- `docs/LOBSTER_DEPLOYMENT.md`

Not adopted:

- no vendored OpenClaw code
- no unofficial private chat automation
- no dependency on child-owned QQ, WeChat, or watch accounts for MVP

### Letta-Style Structured Memory

Adopted:

- store durable structured facts instead of raw chat logs
- keep memory model-agnostic
- load memory by lobster id
- drop unsafe fields before persistence

Lobster implementation:

- `src/lobster/lobster-core.cjs`
- `src/lobster/lobster-sdk.cjs`
- `api/lobster-memory.js`

Not adopted:

- no raw dialogue storage
- no photo/contact/ranking persistence
- no dependency on Letta server runtime

### LangGraph-Style Stateful Teacher Loop

Adopted:

- model the teacher as a loop, not a single reply
- keep parent intake, emotional check-in, child co-view, report, follow-up, and weekly review as ordered states
- preserve human handoff and parent confirmation points

Lobster implementation:

- `src/lobster/lobster-teacher.cjs`
- `src/lobster/lobster-followup.cjs`
- `api/lobster-teacher.js`
- `api/lobster-followup.js`
- `api/lobster-followup-inbox.js`

Not adopted:

- no new graph dependency
- no hidden autonomous action without parent-device receipt

### Hermes-Style Scoped Agents, Skills, And Approvals

Adopted:

- split parent and child capabilities by role
- keep role-scoped tools
- include approval/receipt concepts for follow-up dispatch
- keep operating surfaces testable through manifest and contracts

Lobster implementation:

- `src/lobster/lobster-core.cjs`
- `src/lobster/lobster-product-manifest.json`
- `api/lobster-capability.js`
- `scripts/test-lobster-product-readiness.cjs`
- `scripts/test-lobster-followup.cjs`

Not adopted:

- no external Hermes runtime
- no background agent group that bypasses the parent device
- no unaudited tool execution

## Product Decisions

The MVP is not a child-owned chat bot. It is a parent-device AI teacher:

1. Parent configures the teacher from the official website.
2. The child uses co-view mode on the parent device.
3. The teacher stores safe structured memory.
4. The teacher schedules follow-up.
5. The due scanner creates parent-device inbox items.
6. A dispatch receipt records that the reminder was surfaced.

This closes the teacher loop while avoiding the biggest channel risk: forcing a child to own or bind an external chat account.

## License And Dependency Boundary

No code from the reference projects is copied into this repository. The current Lobster product uses internal Yuandian code plus small Node/CommonJS modules already in the repo. The references are architecture inputs only.

Before adopting any external package, run a separate license, size, security, and deployment review.
