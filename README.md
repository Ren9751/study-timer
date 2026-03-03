# Study Timer

勉強時間を記録するPWAアプリ。

**URL:** https://ren9751.github.io/study-timer/

## 機能

- タイマー計測（一時停止・再開）
- 科目別に記録
- ログをカレンダーで確認
- 統計タブ（日/週/月/年の棒グラフ + ドーナツチャート）

## 技術構成

- HTML / CSS / JavaScript（外部ライブラリなし）
- データは localStorage に保存
- PWA対応（manifest.json + Service Worker）

## デプロイ

GitHub Pages を使用。`master` ブランチに push すると自動で反映される。

```bash
git add .
git commit -m "変更内容"
git push
```

## 開発用

設定モーダル（⚙ボタン）からデモデータの操作ができる。

- **デモを入れる** — 過去21日分のサンプルデータを投入してリロード
- **デモを消す** — 全データを削除してきれいな状態に
