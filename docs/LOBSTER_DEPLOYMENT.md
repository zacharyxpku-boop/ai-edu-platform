# Lobster Deployment Loop

This document defines the sellable technical loop for Lobster as an independent product on the official web surface. It is not a miniapp tab, app rewrite, QQ bot, WeChat private bot, or watch-device dependency.

## Product Shape

Lobster ships first as one parent-device AI teacher workspace:

- Parent Lobster: receives scores, wrong questions, school feedback, and parent observations; returns a decision report and tonight's coaching action.
- Child Lobster: runs in child co-view mode on the parent device; asks low-pressure first-step questions and never gives a full answer.
- Teacher Presence: adds emotional check-in, proactive reminders, evidence queues, and weekly parent handoff.

The default device contract is:

```text
childIndependentAccountRequired: false
primary delivery: parent device
first entry: /lobster.html
official web route: #lobster
```

## User Acquisition And Self-Serve Setup

1. The user finds the product from the official website route `#lobster`.
2. The user opens `/lobster.html` from the web entry.
3. The parent fills the family configuration form:
   - family name
   - child alias
   - grade band
   - subjects
   - parent material or score summary
   - child need or first stuck point
   - preferred follow-up time
4. The page calls `/api/lobster-teacher`.
5. The parent chooses the first delivery surface: Web, Feishu, DingTalk, or deferred WeChat official adapter.
6. For Feishu or DingTalk, the operator configures the platform callback to `/api/lobster-message?mode=channel&channel=feishu` or `/api/lobster-message?mode=channel&channel=dingtalk`.
7. The channel mode on the message API receives messages, routes them through Lobster, and returns a platform-ready reply. `/api/lobster-message?mode=channel&action=send_plan` exposes the official send plan when a configured token exists.
8. The API returns `lobster_unified_teacher_workspace_v1` with:
   - parent teacher desk
   - child co-view mode
   - emotional support state
   - proactive follow-up plan
   - next best action

This is the MVP sale and usage loop. The child does not need to install QQ, bind WeChat, or own a watch-device account.

## Runtime APIs

Use `/api/lobster-teacher` as the default product entry.

```http
POST /api/lobster-teacher
```

Use `/api/lobster-onboarding` when a distributor, sales page, or operator needs to create an activation package before the family starts.

```http
POST /api/lobster-onboarding
```

Use `/api/lobster-message`, `/api/lobster-capability`, and `/api/lobster-session` for embedded product shells or partner integrations that need lower-level role routing.

Use `/api/lobster-memory` only for structured safe facts. Do not store raw dialogue, contact identifiers, photos, rankings, or full answers.

## Proactive Follow-Up

After the teacher workspace is created, persist its follow-up plan:

```http
POST /api/lobster-followup
```

The follow-up record stores structured reminders and evidence queues only. It is safe to scan from a scheduler because it does not contain phone numbers, WeChat IDs, QQ IDs, or raw child dialogue.

Scan due reminders from a cron job or hosted scheduler:

```http
GET /api/lobster-followup-due?now=2026-06-04T00:00:00.000Z
POST /api/lobster-followup-due
```

Local operator runner:

```powershell
npm.cmd run lobster:followup:due -- --now=2026-06-04T00:00:00.000Z
```

The scanner returns `lobster_followup_due_scan_v1`. It does not mark reminders as dispatched and does not perform messaging side effects. A production dispatcher can consume the due payload and send a parent-device notification through the official channel chosen by the deployment.

Render due reminders inside the parent-device product:

```http
GET /api/lobster-followup-inbox?now=2026-06-04T00:00:00.000Z
POST /api/lobster-followup-inbox
```

`GET` returns `lobster_parent_device_inbox_v1` items with a title, action, CTA, and `/lobster.html` URL. `POST` materializes the same items and records safe dispatch receipts. This gives the MVP a product-native reminder surface even before WeChat, QQ, or watch-device adapters exist.

After the official channel or parent-device UI handles a reminder, record a dispatch receipt:

```http
POST /api/lobster-followup
```

```json
{
  "action": "record_dispatch",
  "familyId": "lobster-family",
  "reminderId": "tonight_first_step",
  "status": "dispatched",
  "channel": "parent_device",
  "adapter": "manual-parent-device"
}
```

This receipt closes the operational loop without sending messages from the scanner and without saving contact identifiers.

## Feishu And DingTalk Bot Loop

The current priority after the website is Feishu and DingTalk, because both can run an official bot loop without private-account automation.

Configure inbound callbacks:

```http
POST /api/lobster-message?mode=channel&channel=feishu
POST /api/lobster-message?mode=channel&channel=dingtalk
```

The webhook handles:

- Feishu URL verification challenge.
- Feishu message events with text content.
- DingTalk text robot callback payloads.
- Role inference from message text.
- Child no-final-answer boundary.
- Parent report response.

Build outbound send plans:

```http
POST /api/lobster-message?mode=channel&action=send_plan
```

The send API returns official Feishu or DingTalk request metadata, token environment variable names, and `sent: false` until a platform token is configured and the operator explicitly enables real dispatch. Tokens are never returned in API payloads.

## Channel Policy

Current priority:

- Official website `#lobster`
- Standalone web shell `/lobster.html`
- Parent phone, tablet, or computer
- Feishu official bot callback
- DingTalk official bot callback

Deferred:

- WeChat service flow for parent-side setup, reports, and reminders through compliant official channels.
- QQ official bot only if the platform adapter is approved and implemented through official APIs.
- Watch or child-device integration only after open-platform review.

Do not sell or implement unofficial private chat automation. Do not make the child channel a dependency for the first release.

## Production Storage Note

The current file-backed memory and follow-up storage are suitable for local demos and controlled pilots. For a hosted serverless deployment, move these records to durable storage before relying on scheduler continuity:

- lobster memory facts
- family activation records
- follow-up schedules
- dispatch receipts

The APIs are already shaped to support that migration because callers do not depend on raw file paths.

## Readiness Gates

Run these before claiming the Lobster surface is ready:

```powershell
npm.cmd run lobster:fullcheck
npm.cmd run web:check
npm.cmd run lobster:followup:due -- --now=2026-06-04T00:00:00.000Z
```

Passing these checks proves:

- the child and parent roles remain separated
- the child side blocks direct final answers
- the parent side blocks score-improvement promises
- the official website exposes the Lobster route
- `/lobster.html` calls the unified teacher API
- proactive follow-up can be scanned without contact leakage

After production deployment, run:

```powershell
npm.cmd run lobster:live
```

This live gate checks the cache-busted official homepage, `/lobster.html`, Feishu channel webhook, DingTalk channel webhook, and the official send-plan response. If the naked root homepage is still served from Cloudflare cache, the script prints a warning with the cache status; use `npm.cmd run web:cache:purge` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` when the naked root must update immediately.
