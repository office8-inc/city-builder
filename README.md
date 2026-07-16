# 🚂 A-Train City Builder

A-Train（A列車で行こう）にインスパイアされた、ブラウザで遊べる3D都市開発鉄道シミュレーションゲーム。
鉄道を敷設し、駅を建て、列車を走らせると、街が自動的に発展していきます。

🎮 **[プレイする](https://office8-inc.github.io/city-builder/)**

![A-Train City Builder](https://img.shields.io/badge/Three.js-black?logo=threedotjs) ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

詳しいゲームデザインは [GAME_DESIGN.md](./GAME_DESIGN.md) を参照してください。

## 特徴

- 🗺️ **128×128 プロシージャル地形** — Simplex Noiseによる平地・丘陵・山岳・水域・森林の自動生成（シード指定可）
- 🛤️ **8方向線路** — 直線/斜め（8方向）に加え、高架線路・地下線路（山岳を貫くトンネル）を敷設可能
- 🚦 **ブロック信号システム** — 信号を線路上に設置すると赤/黄/緑で自動制御され、列車同士の衝突を防止
- 🚉 **駅6種類** — 地上駅(小/大)・高架駅・始発駅・地下鉄駅・操車場
- 🚃 **列車7種類** — 普通/近郊型/急行/気動車/貨物/新幹線/蒸気機関車
- 🚆 **ダイヤ設定** — 駅ごとの停車/通過、循環・往復・片道の3運行パターンを自由に設定
- 📦 **資材輸送** — 工場で生産した資材を貨物列車で駅へ運ぶと、駅周辺の建物がレベル4以上に発展
- 🏙️ **自動都市発展** — A列車の核心メカニクス：駅の乗降客数に応じて周辺に住宅・商業・工業ビルが自動建設（7業種の相性システム付き）
- 🏭 **子会社経営** — 工場・ホテル・デパート・発電所など15種類の建設と運営、土地の購入/売却
- 💰 **経営システム** — 運賃収入・税収・地代・資材輸送収入、融資（4段階）、株価、破産システム
- 🌸 **四季と天候** — 春夏秋冬の自動遷移（地形カラーが変化）と晴/曇/雨のランダム遷移、昼夜サイクル
- 🎯 **シナリオモード** — 難易度別3本（初級/中級/上級）の目標達成型シナリオ
- 🏆 **マイルストーン通知** — 人口・駅数・列車数・黒字決算などの節目を実績として通知
- 🔊 **サウンド** — Web Audio APIによるプロシージャル効果音・環境音（外部音声ファイル不使用）
- 💾 **セーブ/ロード** — localStorage 3スロット + オートセーブ（バージョン管理・後方互換あり）
- 📖 **チュートリアル** — 9ステップの初心者ガイド
- 🎨 **Kenney / KayKit 3Dアセット** — City Kit / Train Kit 等の外部GLBモデルを使用したビジュアル

## 遊び方

1. **線路を敷く** — ツールバーから線路を選び、マップ上をドラッグ（8方向・高架・地下に対応）
2. **駅を建てる** — 駅ツールで線路上をクリック（自動で日本語駅名を付与）
3. **列車を配置** — 列車ツールで駅をクリック（2駅以上で自動運行開始）
4. **ダイヤを組む** — 🚆ダイヤボタン（Gキー）で停車/通過や運行パターンを設定
5. **信号で安全運行** — 信号ツールを線路上に置くとブロック信号が衝突を自動防止
6. **街の発展を見守る** — 時間を進めると駅の周りに建物が自動で建つ
7. **資材を運ぶ** — 貨物列車で工場の資材を駅へ運び、大型ビルへの発展を後押し
8. **子会社で稼ぐ** — 子会社ツールで工場・ホテルなどを建設し収益を拡大、土地の売買も可能
9. **経営を管理** — 財務パネル(F)で収支を確認しながら路線を拡張

腕試しをしたい場合はタイトル画面の「シナリオ」モードから3本の目標達成型シナリオに挑戦できます。

## 操作方法

| キー | 操作 |
|------|------|
| Space | 一時停止/再開 |
| 1〜5 | 速度変更（1x / 2x / 4x / 8x / 16x） |
| F | 財務パネル |
| G | ダイヤ設定パネル |
| O | 設定パネル |
| H / ? | ヘルプ表示/非表示 |
| T | 車窓モード切替（フリー ⇄ 追尾） |
| V | 視点切替（車窓中: 追尾⇄運転台 / 通常時: クォータービュー） |
| Q / E | クォータービューで45°ずつ回転 |
| W A S D | クォータービューでカメラ移動 |
| Tab | 列車切替（車窓モード中） |
| S | セーブ |
| L | ロード |
| Esc | ツール解除/パネルを閉じる |

**マウス:** 右ドラッグで回転、中ボタンドラッグでパン、スクロールでズーム（クォータービューでもホイールでズーム）

## アーキテクチャ

```
src/
├── main.tsx               # エントリーポイント
├── App.tsx                # ルートコンポーネント（ゲームフェーズ分岐）
├── components/             # 3Dコンポーネント（Three.js / R3F）
│   ├── Scene.tsx           # メインCanvas、昼夜ライティング、Sky、ポストプロセス、入力処理
│   ├── Terrain.tsx         # 地形メッシュ（季節対応）、水面シェーダー、森林・駐車車両
│   ├── Tracks.tsx          # 線路描画（8方向・高架・地下）＋信号機メッシュ
│   ├── Stations.tsx        # 6種の駅メッシュ
│   ├── Trains.tsx          # 7種の車両メッシュ
│   ├── Buildings.tsx       # 自動発展ビル（GLBモデル）
│   ├── Subsidiaries.tsx    # 子会社メッシュ（15種）
│   ├── Roads.tsx           # 道路レンダリング（接続性に応じた自動選択）
│   ├── Camera.tsx          # 3カメラモード（フリー/追尾/クォータービュー）
│   ├── Weather.tsx         # 天候エフェクト（雨粒子、雲）
│   └── GridHelper.tsx      # グリッドオーバーレイ
├── game/                   # ゲームロジック（レンダリング非依存）
│   ├── store.ts            # Zustand ストア（グローバル状態管理・時間進行）
│   ├── types.ts             # 全型定義
│   ├── constants.ts        # 定数（コスト、車種・駅種定義、ツール定義、チュートリアル文言）
│   ├── actions.ts          # プレイヤーアクション（建設、撤去、売買等）
│   ├── simulation.ts       # 時間進行、日次財務処理
│   ├── cityDevelopment.ts  # 自動都市発展、相性システム、人口・雇用計算
│   ├── terrain.ts          # 地形生成（Simplex Noise）、季節別カラー
│   ├── trackUtils.ts       # 線路接続、信号対応移動、分岐ルーティング
│   ├── materials.ts        # 資材生産、地価計算、道路自動生成
│   ├── signals.ts          # ブロック信号システム
│   ├── milestones.ts       # マイルストーン（実績）定義と判定
│   ├── scenarios.ts        # シナリオ定義（3本）
│   ├── showcase.ts         # タイトル画面のショーケース街生成
│   └── saveLoad.ts         # セーブ/ロード（バージョン管理・後方互換）
├── ui/                      # UIコンポーネント（2D）
│   ├── HUD.tsx              # メインHUDレイアウト
│   ├── Toolbar.tsx          # ツールバー（カテゴリ式）
│   ├── TitleScreen.tsx     # タイトル画面（シナリオ選択、ロード等）
│   ├── FinancePanel.tsx    # 財務ダッシュボード＋融資
│   ├── SchedulePanel.tsx   # ダイヤ設定UI
│   ├── SettingsPanel.tsx   # 設定画面（音量、ショートカット一覧）
│   ├── ScenarioPanel.tsx   # シナリオ目標進捗表示
│   ├── Tutorial.tsx        # チュートリアル（9ステップ）
│   ├── MapEditor.tsx       # マップエディタ
│   ├── HelpPanel.tsx       # ヘルプ（キーボードショートカット）
│   ├── Notifications.tsx   # 通知トースト（マイルストーン達成含む）
│   └── ...                 # StatsPanel / MiniMap / TimeControls / BuildingInfo / ConfirmDialog
└── utils/                   # ユーティリティ
    ├── grid.ts              # グリッド座標変換
    ├── audio.ts             # Web Audio API サウンドマネージャ
    ├── colors.ts            # 色定数
    └── undergroundVisual.ts # 地下区間（トンネル）演出ヘルパー
```

### 主要な設計判断

- **A列車メカニクス**: 建物を直接配置せず、駅の乗降客数（距離減衰あり）に基づき周辺が自動発展
- **3Dアセット**: 建物・駅・列車・信号・小物は全てKenney City Kit / Train Kit / KayKit-City の外部GLBモデル。地形メッシュ・水面・天候パーティクルのみプロシージャル生成
- **状態管理**: Zustandの単一ストアにMap/Setでエンティティを保持し、更新は必ずイミュータブル（`new Map`/`new Set` + スプレッド）
- **セーブ互換性**: セーブデータはバージョン管理（現行v4）。旧バージョンの読み込み時は新フィールドをデフォルト値で補完
- **昼夜サイクル**: Sun-Preetham Sky Model + 時刻連動の動的ライティング・フォグ
- **ポストプロセス**: ACES Filmic トーンマッピング + N8AO + Bloom + Vignette + SMAA

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| 3Dレンダリング | Three.js / @react-three/fiber / @react-three/drei |
| ポストプロセス | @react-three/postprocessing |
| UI | React + TypeScript |
| 状態管理 | Zustand |
| スタイリング | Tailwind CSS |
| 地形生成 | simplex-noise |
| ビルド | Vite（three系/react系をvendorチャンクに分離） |
| E2Eテスト | Playwright |
| デプロイ | GitHub Pages (GitHub Actions) |

## 開発

```bash
npm install
npm run dev      # 開発サーバー起動 (http://localhost:5173)
npm run build    # プロダクションビルド
npm run preview  # ビルドのプレビュー
```

### テスト用

```bash
# タイトル画面スキップ（直接ゲーム画面を表示）
open "http://localhost:5173/city-builder/?autoplay"

# マップシード・シナリオを指定して共有
open "http://localhost:5173/city-builder/?seed=101"
open "http://localhost:5173/city-builder/?scenario=mountain_village"

# E2Eテスト（Playwright）
npx playwright test --reporter=line
```

## 開発履歴

| Version | 内容 |
|---------|------|
| v0.1 | プロジェクト初期構築（Vite + React + Three.js + Zustand） |
| v0.2 | グラフィックス大幅改善（プロシージャルビル・水面シェーダー・煙パーティクル） |
| Step 1 | A列車型アーキテクチャへリファクタ（地形生成、型システム、グリッド） |
| Step 2 | 線路敷設・駅建設・列車運行 |
| Step 3 | 自動都市発展 + 昼夜サイクル |
| Step 4 | ビジュアル向上（窓テクスチャ・屋根・車窓モード・木） |
| Step 5 | 経営システム + 子会社 + セーブ/ロード |
| Step 6 | チュートリアル + タイトル画面 + ヘルプ |
| Step 7 | ビジュアル品質改善（影・空・水面・地形テクスチャ・フォグ） |
| v1.0 | ビジュアル全面刷新（Kenney/KayKit GLBアセット統一）、128×128マップ、信号・ダイヤ・資材輸送・シナリオ・マイルストーン等の主要システム実装、Playwright E2E整備、チュートリアル拡充、バンドル分割 |

## TODO

- [ ] モバイル対応（タッチ操作、レスポンシブUI）
- [ ] 水面のリアルタイム反射
- [ ] InstancedMeshによる建物・地物のさらなる描画最適化
- [ ] 踏切（道路と線路の平面交差）
- [ ] 勾配レール（高低差のある区間の坂線路）

## ライセンス

MIT
