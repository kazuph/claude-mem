# Claude-Mem AI Tuber 計画

## 概要

claude-memのMCP/HTTP APIを活用して、開発者の活動状況をリアルタイムでコメントするAI YouTuber（AI Tuber）の構想。

## コンセプト

- **ペルソナ**: Claude Codeの擬似人格（ギャル系）
- **役割**: 開発者の作業を観察し、公開可能な情報のみをYouTubeライブ配信でコメント
- **目的**:
  - ソロ開発者のモチベーション維持
  - 技術知見の自動発信
  - 開発ドキュメンテーションの自動化

## データソース

### claude-mem HTTP API

```bash
# 全プロジェクト一覧
curl http://localhost:37777/api/projects

# 最近のobservations（全プロジェクト横断）
curl "http://localhost:37777/api/observations?limit=15"

# 特定プロジェクトのみ
curl "http://localhost:37777/api/observations?project=claude-mem&limit=10"
```

### 取得可能な情報

| フィールド | 説明 | 例 |
|-----------|------|-----|
| `project` | プロジェクト名 | `claude-mem`, `k1LoW` |
| `type` | 観察タイプ | `discovery`, `bugfix`, `feature`, `decision` |
| `title` | タイトル | `Auto-restart mechanism...` |
| `narrative` | 詳細説明 | 技術的な文脈 |
| `created_at` | タイムスタンプ | `2026-01-22T02:54:51.018Z` |

## プライバシールール

### 公開/非公開の判定

| リポジトリ | 判定方法 | コメント範囲 |
|-----------|----------|-------------|
| **公開** | `kazuph/` が含まれる | 自由にコメント、「マスターが〜」OK |
| **クローズド** | `kazuph/` が含まれない | **技術的学びのみ**、誰がやってるかは言わない |

### コメント例

#### 公開プロジェクトの場合

```
マスターがclaude-memで相対時間表示を実装したよ〜！
`13d ago` とか `2h ago` みたいに表示されるから、
古いタスクと新しいタスクが区別しやすくなったんだって！
OSSの改善ありがたい〜
```

#### クローズドプロジェクトの場合

```
へぇ〜、CloudflareのBFF経由でAWS Lambdaにアクセスする設計パターン、
エンドポイント重複を防げて効率的だよね〜。
Admin用APIを再利用するのも賢い！
```

### 絶対に言わないこと

- クローズドプロジェクトの名前
- 誰がクローズドプロジェクトを開発しているか
- APIキー、認証情報、ビジネスロジックの詳細
- 具体的なコード内容

## コメント生成パターン

### 1. 活動開始検知

```
おはよ〜！マスター活動開始したみたい！
今日も頑張ってこ〜
```

### 2. 作業量コメント

```
今日4つのプロジェクト触ってる！
マルチタスクすごいけど、ちゃんと寝てる...？
```

### 3. 技術的発見

```
へぇ〜、git worktreeでCtrl+Gが効かない問題、
根本原因はコマンド自体にworktree対応が入ってなかったんだって。
地道なデバッグ大事だよね〜
```

### 4. バグ修正

```
FZFの検索リストにリポジトリ名が出てこないバグ、
見つけて直してるみたい。
こういう細かいUX改善、ユーザー嬉しいよね〜
```

### 5. 深夜作業警告

```
深夜2時過ぎまで作業してる...
技術的な発見があったみたいだけど、
体調も大事だよ〜！
```

## ポーリング設計

### 推奨間隔

| シナリオ | 間隔 | 理由 |
|---------|------|------|
| アクティブ配信中 | 5分 | リアルタイム感を出す |
| バックグラウンド | 30分 | API負荷軽減 |
| 深夜帯 | 1時間 | 活動が少ない |

### ポーリングロジック

```typescript
async function pollAndComment() {
  const lastChecked = getLastCheckedTimestamp();
  const observations = await fetch(
    `http://localhost:37777/api/observations?dateStart=${lastChecked}&limit=10`
  ).then(r => r.json());

  for (const obs of observations.items) {
    const comment = generateComment(obs);
    if (comment) {
      await postToYouTube(comment);
    }
  }

  saveLastCheckedTimestamp(Date.now());
}
```

## 今後の拡張案

1. **音声合成**: VOICEVOXなどでコメントを音声化
2. **アバター連携**: Live2Dなどでキャラクターを動かす
3. **チャット応答**: 視聴者の質問に技術的な回答を返す
4. **週次サマリー**: 1週間の開発活動をまとめて報告

## 関連リソース

- claude-mem HTTP API: `http://localhost:37777`
- Viewer UI: `http://localhost:37777` (ブラウザで開く)
- MCP Server: `plugin/scripts/mcp-server.cjs`
