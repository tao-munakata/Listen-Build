# AI Development OS - Today Progress

Date: 2026-05-11

## Current Status

- Local app is running at http://localhost:3000.
- Server command: `npm run dev`
- Gemini API is configured through `.env`.
- Gemini model uses auto discovery and has worked with `gemini-2.5-flash`.
- Main UI appearance is approved by the user.

## Implemented

- Local AI Development OS MVP.
- Daily workflow tab:
  - 未処理Inbox
  - 対応中
  - 次にやる候補
- Project management with six windows:
  - idea
  - requirement
  - design
  - bug
  - feature
  - version
- Inbox capture.
- Rule-based classification.
- Gemini generation into Inbox.
- Gemini reclassification.
- AI整理 for Inbox classification and high-confidence routing.
- Webhook endpoints for external capture.
- Browser extension scaffold.
- Audit log tab and API.
- Search tab and API.
- CHANGELOG generation.
- Design document generation.
- Local Git tab/API:
  - init
  - status
  - commit
- AI Scrum Master tab/API.
- Scrum recommendations based on:
  - pending Inbox
  - open entries
  - high-priority bugs
  - recent audit logs
- Scrum action buttons:
  - open relevant window
  - mark entries as in progress
  - run Inbox organize
  - generate design docs
  - generate changelog
- Entry status update API:
  - `PATCH /api/entries/{entryId}`
- Entry buttons:
  - 対応中にする
  - 完了にする
  - 未着手に戻す

## Verification

- Syntax checks passed:
  - `node -c app/src/store.js`
  - `node -c app/src/server.js`
  - `node -c app/public/main.js`
- Scrum API verified:
  - `GET /api/projects/aios-demo/scrum/plan`
- Entry status update verified.

## Important Note

The user found the label `着手` unclear.
This was addressed on 2026-05-12:

- `着手` was renamed to `対応中にする`.
- `完了` was renamed to `完了にする`.
- `再Open` was renamed to `未着手に戻す`.

## Current Data Note

For verification, the high-priority bug entry:

- `Inbox分類結果が表示されない`

was updated from `open` to `in_progress`.

## Next Candidate Step

- Drag-and-drop between sprint columns (期限切れ / 対応中 / 次候補)
- Milestone / sprint view: group entries by due-date week
- Owner filter: show only entries assigned to a specific person
