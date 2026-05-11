# Listen-Build

課題を聞いて、その場でアプリを作成し提供する。

## AI Development OS

Local-first MVP for the AI開発OS concept.

## Start

```bash
npm run dev
```

Open http://localhost:3000.

## CLI

```bash
scripts/new-project.sh "Patent Navi"
scripts/ai-save.sh --project patent-navi --source chatgpt --text "API設計を追加したい"
scripts/bug-add.sh --project patent-navi --title "ログインできない" --priority 8 --body "再現手順..."
scripts/webhook-save.sh --project patent-navi --source gemini --text "Gemini output..."
```

## Gemini API

Set `GEMINI_API_KEY` before starting the server.

```bash
export GEMINI_API_KEY="..."
export GEMINI_MODEL="auto"
npm run dev
```

Then use the `Gemini API` button in the UI. The prompt in the text area is sent to Gemini, and Gemini's answer is saved into Inbox with `sourceAi: gemini`.

`GEMINI_MODEL=auto` asks the API for available `generateContent` models and chooses a supported Flash model when possible.

## Gemini Inbox Classification

Inbox cards have a `Gemini分類` button. It sends the Inbox text to Gemini and updates:

- `classifiedTag`
- `suggestedCategory`
- `confidence`
- `suggestedTitle`
- `classificationReason`

API:

```text
POST /api/inbox/{id}/reclassify
```

Body:

```json
{
  "provider": "gemini"
}
```

## Semi-Automatic Routing

Inbox view has a `高信頼を自動振り分け` button. It routes all not-done Inbox items with confidence `>= 0.8` into their suggested window.

API:

```text
POST /api/projects/{projectSlug}/inbox/auto-route
```

Body:

```json
{
  "threshold": 0.8
}
```

## AI Organize

Inbox view has an `AI整理` button. It classifies not-done Inbox items with Gemini, then routes high-confidence items into their suggested windows.

API:

```text
POST /api/projects/{projectSlug}/inbox/organize
```

Body:

```json
{
  "threshold": 0.8,
  "limit": 10
}
```

## Audit Log

Use the `監査` tab to inspect recent project activity, including Inbox creation, Gemini classification, routing, and entry creation.

API:

```text
GET /api/projects/{projectSlug}/audit?limit=100
```

## Search

Use the `検索` tab to search across window entries, Inbox messages, and audit logs for the selected project.

API:

```text
GET /api/projects/{projectSlug}/search?q=keyword&limit=50
```

## Changelog

Use the `変更履歴` tab to generate and inspect `CHANGELOG.md` for the selected project.

API:

```text
GET /api/projects/{projectSlug}/changelog
POST /api/projects/{projectSlug}/changelog
```

## Design Docs

Use the `設計書` tab to generate `docs/設計書.md` from window entries.

API:

```text
GET /api/projects/{projectSlug}/docs/design
POST /api/projects/{projectSlug}/docs/design
```

## Git

Use the `Git` tab to initialize a local repository, inspect changes, and commit a snapshot.

API:

```text
GET /api/git/status
POST /api/git/init
POST /api/git/commit
```

## AI Scrum Master

Use the `Scrum` tab to inspect deterministic next-action recommendations and execute common actions:
open the relevant window, mark an entry as `in_progress`, organize Inbox, and regenerate docs or changelog.

## Daily Workflow

Use the `今日` tab for the morning work view:

- 未処理Inbox
- 対応中
- 次にやる候補

API:

```text
GET /api/projects/{projectSlug}/scrum/plan
PATCH /api/entries/{entryId}
```

## Webhook

Generic endpoint:

```text
POST /api/webhooks/inbox
POST /api/webhooks/{source}/inbox
```

JSON body:

```json
{
  "project": "patent-navi",
  "sourceAi": "gemini",
  "rawContent": "Captured text"
}
```

Optional token protection:

```bash
export AI_DEV_OS_WEBHOOK_TOKEN="local-secret"
```

Send the token with `x-ai-dev-os-token`.

## Browser Extension

Load `browser-extension/` as an unpacked Chrome extension. It captures selected text or the current page URL and sends it to:

```text
http://localhost:3000/api/webhooks/browser/inbox
```

## Phase 1 Scope

- Project creation
- Six windows
- Inbox capture
- Rule-based classification
- Human routing
- Markdown Vault sync
- Audit log
