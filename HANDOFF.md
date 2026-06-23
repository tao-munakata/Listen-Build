# HANDOFF.md — ListenBuild

## プロジェクト概要
<!-- 目的・概要を記載 -->

## 技術スタック
<!-- フレームワーク・DB・外部サービスなど -->

## 環境構築
```bash
# セットアップ手順を記載
```

## 現状
<!-- 実装済み機能・現バージョン -->

## 残タスク
<!-- 次にやること -->

## セッション記録
<!-- /exit 時に自動追記 -->

## 2026-01-17 セッション記録
- v0.2.0 実装完了：デイリーワークフロー＆AI Scrum Master タブ追加
- Inbox未処理・対応中・次にやる候補の3列表示、AI推薦アクション機能実装
- エントリステータス更新 API (`PATCH /api/entries/{entryId}`) 実装
- main ブランチ（コミット 4本）、package-lock.json 未追跡
- 残タスク: 期日・オーナー機能追加でスプリントボード化

## 2026-01-18 セッション記録
- スプリントボード機能実装：期限・担当者フィールド追加、color-coded期限バッジ表示
- `store.js`：`dueDate`・`owner`フィールド追加、`createEntry`・`updateEntry`でサポート
- `main.js`：`dueBadge()`関数で期限ステータス色分け、`bindInlineEdit()`でカード上インライン編集
- `renderToday()`を「スプリントボード」に改名、期限切れセクション先頭化、期限日順ソート
- `styles.css`：期限バッジ・担当者チップのスタイル追加
- 修正ファイル：app/public/main.js、app/public/styles.css、app/src/store.js

## 2026-06-23 セッション記録
- `npm run dev` でアプリ実行確認：ローカル 3000 ポートで正常動作を確認
- 「今日」タブのスプリントボード表示・デイリーワークフロー、AI Scrum Master タブ機能確認
- VPS デプロイの検討：`data/store.json` ローカルファースト設計のため、複数端末アクセス対応要検討
- 未コミット変更：`.gitignore`, `TODAY_PROGRESS.md`, app 配下の JS・CSS・store.js
- 残タスク：VPS 環境へのデプロイ・複数端末対応、本番環境設定

## 2026-01-19 セッション記録
- サイドバー案件削除機能実装：各案件に `×` ボタンを追加、ホバーで赤ハイライト
- 削除時確認ダイアログ表示（「エントリーとInboxもすべて削除されます」）、OK で削除
- API 実装：`DELETE /api/projects/:projectRef`（関連エントリー・Inbox も一括削除）
- 削除後自動リロード、選択中案件削除時は選択状態解除
- 修正ファイル：app/public/main.js、app/public/styles.css、app/src/server.js、app/src/store.js

## 2026-06-23 セッション記録（削除機能実装完了）
- サイドバー案件削除ボタン UI 完成：`renderProjects()` で各案件の横に削除ボタン追加、スタイリング完了
- 削除確認ダイアログ実装：削除前に「この案件とエントリーをすべて削除します」確認、OK で実行
- DELETE API 完成：`DELETE /api/projects/:projectRef` で関連データ一括削除、自動リロード
- サーバー再起動・ブラウザリロードで削除ボタン機能確認完了
- 残タスク：複数端末対応、本番環境デプロイ

## 2026-06-23 セッション記録（削除機能デバッグ）
- `deleteProject` をstore.js の `module.exports` に追加（エクスポート漏れバグ修正）
- サーバー再起動してブラウザリロード、削除ボタン機能確認
- 変更ファイル：app/src/store.js（1 行追加）
- 残タスク：複数端末対応、本番環境デプロイ
