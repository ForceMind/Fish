# Fishing Joy

[🇬🇧 English](./README.md) | [🇨🇳 中文](./README.zh.md) | [🇯🇵 日本語](./README.ja.md) | [🇪🇸 Español](./README.es.md)

Fishing Joy は **PixiJS v8** と **Tone.js** で構築されたスタンドアロンのブラウザ向け釣りゲームです。ビルド工程は不要で、ローカルの静的サイトとして実行できます。

## 主な機能

- WebGL による水面ゆらぎとレイヤー構成
- 魚の自動スポーンと群れフォーメーション
- ローカル保存のコイン表示と砲台パワー調整
- シンセベースの効果音とループ BGM
- [index.html](./index.html) からのシンプルなスクリプト読み込み

## 起動方法

### Windows でワンクリック起動

[run.bat](./run.bat) をダブルクリックしてください。

このスクリプトは次を実行します。

- `py` または `python` を確認
- `http://localhost:8080/` でローカルサーバーを起動
- 既定のブラウザでゲームを開く

### 手動起動

```powershell
cd E:\Privy\Fish
python -m http.server 8080
```

その後、[http://localhost:8080](http://localhost:8080) を開きます。

## 必要環境

- `py` または `python` として利用できる Python 3
- WebGL を有効にしたモダンブラウザ
- [index.html](./index.html) で PixiJS と Tone.js を CDN 読み込みするためのインターネット接続

## ディレクトリ構成

- [index.html](./index.html): ページ入口とスクリプト読み込み順
- [src](./src): ゲームロジック、描画、音声、エンティティ
- [images](./images): スプライトシートと UI テクスチャ
- [loop-01.mp3](./loop-01.mp3): ループする BGM

## 補足

- `file://` で直接開かず、ローカル静的サーバー経由で実行してください。
- コイン処理は外部プラットフォーム連携ではなく、プレイ中のローカル状態のみを使用します。
