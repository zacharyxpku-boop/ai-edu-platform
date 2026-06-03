# Lobster Product Usage

This is an independent product layer. It does not require miniapp tabs or app UI changes.

## SDK

```js
const { createLobsterProduct } = require('./src/lobster/lobster-sdk.cjs');

const lobster = createLobsterProduct({
  productId: 'family-lobster',
  config: {
    child: {
      displayName: 'Child Lobster',
      tools: ['mini_lesson_bridge']
    },
    parent: {
      displayName: 'Parent Lobster',
      tools: ['weekly_trend_brief']
    }
  }
});

const child = await lobster.sendMessage({
  role: 'child',
  message: 'I am stuck. Tell me the answer.',
  taskType: 'math_word_problem',
  persistMemory: true
});

const parent = lobster.runCapability({
  role: 'parent',
  capabilityId: 'parent_script_generator',
  message: 'Math scores are 82, 88, 84. Word problems create anxiety.'
});
```

## API

Default product entry: one parent-device AI teacher.

```http
POST /api/lobster-teacher
```

This is the preferred product flow. It creates one unified teacher workspace instead of asking the child to install or bind a separate chat account. The response includes:

- parent teacher desk
- child co-view mode on the parent device
- emotional support state
- proactive follow-up reminders
- weekly parent report handoff

The child independent account requirement is false by default. QQ, WeChat bots, and watch devices are optional future channel adapters, not the MVP dependency.

Persist and read the teacher follow-up schedule:

```http
POST /api/lobster-followup
GET /api/lobster-followup?family_id=lobster-family
POST /api/lobster-followup   // { "action": "record_dispatch", ... }
POST /api/lobster-followup   // { "action": "record_event", ... }
GET /api/lobster-followup-due?now=2026-06-04T00:00:00.000Z
POST /api/lobster-followup-due
GET /api/lobster-followup-inbox?now=2026-06-04T00:00:00.000Z
POST /api/lobster-followup-inbox
```

This stores only structured reminders, evidence queues, and completion events. It does not store raw dialogue, contact fields, or child account credentials. The MVP delivery channel is the parent device; external messaging adapters can consume the same due reminder payload later.
Delivery adapters should call `record_dispatch` after a parent-device reminder is shown or handed to an official notification channel. The receipt records status, reminder id, adapter name, and safety flags only; it performs no messaging side effects.
The inbox endpoint turns due reminders into `lobster_parent_device_inbox_v1` items that the parent device can render inside the product. `POST /api/lobster-followup-inbox` materializes those items and records safe dispatch receipts without sending external messages.

Scan due reminders for a cron job or hosted scheduler:

```powershell
npm.cmd run lobster:followup:due -- --now=2026-06-04T00:00:00.000Z
```

The runner prints `lobster_followup_due_scan_v1` JSON with `familyId`, reminder id, due time, channel, and action. It intentionally does not include phone numbers, WeChat IDs, QQ IDs, or raw child dialogue.

Receive Feishu or DingTalk bot messages through official platform callbacks:

```http
GET /api/lobster-message?mode=channel
POST /api/lobster-message?mode=channel&channel=feishu
POST /api/lobster-message?mode=channel&channel=dingtalk
```

The webhook endpoint normalizes platform message formats, routes the text to the guarded Lobster runtime, and returns `lobster_channel_response_v1` with a platform-ready text reply. It does not store raw dialogue or platform contact identifiers.

Build an outbound send plan for the selected official channel through the same webhook function, so the Hobby deployment stays under the serverless-function limit:

```http
GET /api/lobster-message?mode=channel&action=send_plan
POST /api/lobster-message?mode=channel&action=send_plan
```

The send endpoint returns the Feishu or DingTalk official API request plan and checks whether the required platform token environment variable is configured. It never returns platform tokens and does not pretend to send when the token is missing.

Create the family activation package that tells the user where to find and configure the product:

```http
POST /api/lobster-onboarding
```

Example payload:

```json
{
  "familyName": "Pilot family",
  "childAlias": "Kid",
  "gradeBand": "grade 5",
  "subjects": ["math", "english"],
  "parentGoal": "reduce homework conflict",
  "childNeed": "word problem first step",
  "childChannel": "web_h5"
}
```

The response includes the parent entry, child entry, channel setup status, share copy, safety boundaries, and the role-scoped child/parent lobster config.

Open the self-serve product shell:

```text
http://127.0.0.1:3017/lobster.html
```

Recommended rollout:

- Web/H5 is the first family setup and co-view channel.
- Feishu robot is the first official bot adapter for institutions, teachers, and operators.
- DingTalk robot is the second official bot adapter for schools, classes, and agencies.
- WeChat is deferred to compliant official channels such as miniapp, official account, subscription messages, or WeCom. Do not use private-account automation.

Configure lobsters:

```http
POST /api/lobster-config
```

Send a role-scoped message:

```http
POST /api/lobster-message
```

Run one capability:

```http
POST /api/lobster-capability
```

Run a full family session:

```http
POST /api/lobster-session
```

Read or append safe memory facts:

```http
GET /api/lobster-memory?lobster_id=child_lobster
POST /api/lobster-memory
```

## Safety Invariants

- Child Lobster never gives final answers or full solutions.
- Parent Lobster never promises score improvement or uses ranking marketing.
- Public API responses strip raw internal engine objects.
- Memory stores structured facts only, not raw dialogue, photos, contact fields, rankings, or full answers.
- Server provider keys are read only from environment variables and never returned to clients.

## Verification

```powershell
node scripts\test-lobster-fullcheck.cjs
```
