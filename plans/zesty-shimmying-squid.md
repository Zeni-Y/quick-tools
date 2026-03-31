# Commit Plan

## Changed Files

- `index.html` — trim controls UI (sidebar buttons + overlay canvas)
- `js/pdf.js` — trim state management, overlay draw, drag select, CropBox export
- `style.css` — trim overlay, badge, active button styles

## Security / Temporary Code Check

No security concerns. No debug/temporary code detected.

## Proposed Commit Message

```
feat(pdf): PDFページトリム機能を追加

インタラクティブなドラッグ選択でページのトリム範囲を設定できる機能を追加。
オーバーレイキャンバスで視覚的にトリム範囲を確認でき、PDF書き出し時に
CropBox を適用する非破壊的な方式で埋め込みテキストを保持。

- トリムモード ON/OFF 切り替えボタン
- ドラッグでトリム範囲を選択するオーバーレイキャンバス
- 選択ページ / 全ページへの一括適用オプション
- サムネイルにトリム済みバッジ（✂）を表示
- PDFLib setCropBox でエクスポート時にトリムを反映
```

## Steps to Execute

1. `git add index.html js/pdf.js style.css`
2. `git commit -m "<above message>"`
