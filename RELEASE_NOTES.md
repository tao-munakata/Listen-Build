# Release Notes

## v0.3.0 - 2026-06-23

- Added due date and owner fields to entries.
- Sprint board view in Today tab: overdue / in-progress / next columns, sorted by due date.
- Inline date picker and owner input on every entry card (auto-saves on change).
- Added project delete button in sidebar (removes project, entries, and inbox).

## v0.2.0 - 2026-05-12

- Added Gemini API integration and model auto-discovery.
- Added Webhook capture endpoints and browser-extension scaffold.
- Added Inbox AI整理, Gemini reclassification, and high-confidence routing.
- Added Audit, Search, CHANGELOG, Design Docs, Git, Scrum, and Today tabs.
- Added Scrum recommendations and action buttons.
- Added entry status updates:
  - 対応中にする
  - 完了にする
  - 未着手に戻す
- Added `PATCH /api/entries/{entryId}`.
- Added daily workflow view for 未処理Inbox, 対応中, and 次にやる候補.
