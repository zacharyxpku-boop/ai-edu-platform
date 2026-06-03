# Lobster Learning Agents

## Product Direction

Lobster is an independent product layer, not a miniapp UI feature. It has two configurable agents:

- Child Lobster: a teacher-like learning companion that replies to the child, asks for the first step, blocks direct-answer behavior, and creates review/report evidence.
- Parent Lobster: a parent-facing learning analyst that accepts grades, wrong-question notes, and parent observations, then produces a guarded evidence-first report and tonight action plan.

Both lobsters reuse the current Yuandian learning engines instead of rebuilding the educational logic.

## Open-Source Patterns To Borrow

OpenClaw-style pattern ([OpenClaw.rocks](https://github.com/OpenClaw-rocks), [openclaw/openclaw VISION](https://github.com/openclaw/openclaw/blob/main/VISION.md)):

- Keep personality separate from tools.
- Route each user message through a small capability registry.
- Let future product shells change channel without changing education logic.

Hermes-style agent pattern ([NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)):

- Treat role, memory, and skills as explicit agent configuration.
- Store concise memory facts rather than full raw transcripts.
- Keep tools bounded and auditable.

Decision: adopt the patterns, not the dependencies. This keeps the product small, avoids new package risk, and allows the existing education engines to remain the source of truth.

## Existing Code Reused

- `miniprogram/utils/tutor-ladder.js`: child-facing Socratic reply, answer-boundary guard, review seed generation, AI/local decision boundary.
- `miniprogram/utils/learning-report.js`: parent-facing score/material parsing, parent decision book, personalized parent report preview.
- `miniprogram/utils/storage.js`: future persistence target for safe memory, review seeds, report state, and unified next actions.
- `miniprogram/utils/api.js`: future transport pattern for tutor message, material analysis, and report job status.

## Implemented Core

File: `src/lobster/lobster-core.cjs`
SDK: `src/lobster/lobster-sdk.cjs`
Manifest: `src/lobster/lobster-product-manifest.json`
API: `api/lobster-message.js`
Config API: `api/lobster-config.js`
Memory API: `api/lobster-memory.js`
Capability API: `api/lobster-capability.js`
Session API: `api/lobster-session.js`

Implemented capabilities:

- `createLobsterConfig`
- `createLobsterPair`
- `configureLobsterPair`
- `buildChildLobsterReply`
- `buildParentLobsterReport`
- `routeLobsterMessage`
- `buildMemorySummary`
- `persistLobsterMemory`
- `runLobsterModelAdapter`
- `buildLobsterProductPlan`
- `createLobsterProduct` in the SDK wrapper

The module is UI-independent and can be called from a web app, API route, WeChat miniapp, CLI, or future chat shell.

The API accepts `POST /api/lobster-message` with `role: "child"` or `role: "parent"` and returns public-safe output with raw engine internals stripped.

The config API accepts `GET /api/lobster-config` for available capabilities/defaults and `POST /api/lobster-config` for a configured child/parent lobster pair. It filters role-incompatible tools and returns warnings instead of silently enabling unsafe capabilities.

The message API can persist safe memory facts with `persistMemory: true`. It stores structured facts only, not raw dialogue, original photos, contact fields, scores/rankings for sharing, or full solutions.

The memory API accepts `GET /api/lobster-memory?lobster_id=...` and `POST /api/lobster-memory`. It exposes only safe facts and does not provide a destructive delete endpoint.

The capability API accepts `POST /api/lobster-capability` with a role and capability id. It runs specific child or parent capabilities, such as child mini-lesson bridge, review seed generation, parent weekly trend brief, evidence gap planning, and low-pressure parent scripts.

The session API accepts `POST /api/lobster-session` and orchestrates a full family learning session: child lobster response, parent lobster report, a parent-readable handoff, optional safe memory persistence for both lobsters, and raw-internal stripping for public responses.

The SDK exposes `createLobsterProduct`, which gives future independent product shells one stable integration surface for configuration, messages, capabilities, sessions, and safe memory.

The manifest lists all product surfaces, APIs, role tools, safety boundaries, source-reference patterns, and verification commands. The package script `npm run lobster:fullcheck` runs the dedicated product verification chain.

The model adapter entrypoint allows a future server LLM provider to be plugged in, but child replies still pass through `guardAiTutorReply`, and parent replies pass through a parent-safety guard that blocks score guarantees, ranking marketing, fixed labels, and private transcript leakage.

The message API can request a server model provider with `useServerModel: true` and `modelProvider`. Provider keys are read only from server environment variables, never from client payloads, and are never returned in public responses. If no provider key is configured, the product falls back to local guarded lobster behavior.

## Product Execution Plan

1. Core engine
   - Status: implemented.
   - Output: child/parent agent configs, guarded child replies, parent reports, safe memory summaries.

2. Service API
   - Status: message API implemented as `api/lobster-message.js`.
   - Status: config API implemented as `api/lobster-config.js`.
   - Status: model adapter guard implemented in `runLobsterModelAdapter`.
   - Status: memory API implemented as `api/lobster-memory.js`.
   - Status: capability API implemented as `api/lobster-capability.js`.
   - Status: family session API implemented as `api/lobster-session.js`.
   - Status: provider adapter wired in `api/lobster-message.js` with local fallback and no key exposure.
   - Next: add provider observability receipts and production rate limits.
   - Persist only memory facts, not full child dialogue or private parent data.

3. Independent product shell
   - Create a standalone chat/report interface.
   - Separate child and parent sessions.
   - Let parents configure tone, subjects, grade band, and privacy policy.
   - Let children configure name/voice only within parent-approved boundaries.

4. Memory and evidence
   - Status: safe JSON memory implemented through `persistLobsterMemory`.
   - Store safe facts: task type, first-step attempts, wrong-cause guesses, score subjects, parent observations, next evidence.
   - Drop unsafe fields: full answer, raw full dialogue, original question photo, ranking, phone, WeChat, child name.

5. Release gates
   - Child Lobster must never output final answers or long complete solutions.
   - Parent Lobster must never promise score improvement or infer long-term traits from one score.
   - Reports must be evidence-first and parent-confirmed before export/share.

## Verification

Run:

```powershell
node scripts\test-lobster-product-core.cjs
node scripts\test-lobster-api.cjs
node scripts\test-lobster-config-api.cjs
node scripts\test-lobster-memory-api.cjs
node scripts\test-lobster-capability-api.cjs
node scripts\test-lobster-session-api.cjs
node scripts\test-lobster-sdk.cjs
node scripts\test-lobster-manifest.cjs
node scripts\test-lobster-product-readiness.cjs
node scripts\test-lobster-fullcheck.cjs
npm run lobster:fullcheck
```

The test proves that:

- child and parent lobsters are separately configurable,
- child messages route to teacher-style guarded replies,
- unsafe answer requests create answer-boundary evidence and review seeds,
- parent score/observation input creates report output,
- memory summaries do not store raw dialogue or private fields.
