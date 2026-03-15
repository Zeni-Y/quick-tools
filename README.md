# Quick Tools

ブラウザだけで使える軽量ツール集。サーバー不要で、すべての処理がクライアントサイドで完結します。

## 機能

### 画像モザイク
- 画像ファイル（PNG, JPG, WebP）を読み込み、範囲を選択してモザイク/ブラーを適用
- 矩形モザイク: ブロックサイズを調整可能
- ガウスブラー: ぼかし強度を調整可能
- 元に戻す（1回分のアンドゥ）
- PNG / JPG 形式で保存

### PDF ツール
- PDF のページ一覧をサムネイル表示
- ページの回転（90° / 180° / 270°）
- 回転を反映した PDF の再書き出し
- 選択ページを JPG 画像として書き出し

## 使い方

ローカルで HTTP サーバーを起動して `index.html` を開いてください（ES Modules を使用しているため `file://` プロトコルでは動作しません）。

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .
```

ブラウザで `http://localhost:8000` にアクセスしてください。

## ファイル構成

```
quick-tools/
├── index.html      # メインHTML
├── style.css       # スタイルシート
├── js/
│   ├── app.js      # タブ切り替え・モジュール読み込み
│   ├── utils.js    # 共通ユーティリティ（toast, loading, drop zone）
│   ├── mosaic.js   # 画像モザイク機能
│   └── pdf.js      # PDFツール機能
└── README.md
```

## 外部ライブラリ

以下のライブラリを CDN から読み込みます（初回使用時に自動ロード）。

- [pdf.js](https://mozilla.github.io/pdf.js/) v4.9.124 — PDF の読み込み・レンダリング
- [jsPDF](https://github.com/parallax/jsPDF) v2.5.2 — PDF の書き出し

## 動作環境

モダンブラウザ（Chrome, Firefox, Safari, Edge の最新版）で動作します。
