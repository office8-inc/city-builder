# 🚂 A-Train City Builder

A-Train（A列車で行こう）にインスパイアされた、ブラウザで遊べる3D都市建設シミュレーションゲーム。  
鉄道を敷設し、駅を建て、列車を走らせると、街が自動的に発展していきます。

🎮 **[プレイする](https://office8-inc.github.io/city-builder/)**

![A-Train City Builder](https://img.shields.io/badge/Three.js-black?logo=threedotjs) ![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

## 特徴

- 🗺️ **64×64 プロシージャル地形** — Simplex Noiseによる山・丘・平地・川の自動生成
- 🚃 **鉄道シミュレーション** — 線路敷設、駅建設、列車の自動往復運行
- 🏙️ **自動都市発展** — A列車の核心メカニクス：駅周辺に住宅・商業・工業ビルが自動建設
- 🏭 **子会社経営** — 工場・ホテル・百貨店・発電所の建設と運営
- 💰 **経営システム** — 運賃収入、税収、維持費、融資の財務シミュレーション
- 🌅 **昼夜サイクル** — 太陽位置・空の色・フォグ・建物の窓明かりが時間で変化
- 🚂 **車窓モード** — 列車の先頭から街を眺める
- 💾 **セーブ/ロード** — localStorage + オートセーブ
- 📖 **チュートリアル** — 5ステップの初心者ガイド

## 遊び方

1. **線路を敷く** — ツールバーから線路を選び、マップ上をドラッグ（南北/東西方向）
2. **駅を建てる** — 駅ツールで線路上をクリック（自動で日本語駅名を付与）
3. **列車を配置** — 列車ツールで駅をクリック（2駅以上で自動往復開始）
4. **街の発展を見守る** — 時間を進めると駅の周りに建物が自動で建つ
5. **子会社で稼ぐ** — 子会社ツールで工場・ホテルなどを建設し収益を拡大
6. **経営を管理** — 財務パネル(F)で収支を確認し、路線を拡張

## 操作方法

| キー | 操作 |
|------|------|
| Space | 一時停止/再開 |
| 1-4 | 速度変更（1x / 2x / 4x / 8x） |
| F | 財務パネル |
| T | 車窓モード |
| H | ヘルプ |
| S | セーブ |
| L | ロード |
| Tab | 列車切替（車窓モード中） |
| Esc | ツール解除/パネルを閉じる |

**マウス:** 右ドラッグで回転、中ボタンでパン、スクロールでズーム

## アーキテクチャ

```
src/
├── components/          # Three.js 3Dコンポーネント
│   ├── Scene.tsx        # メインシーン（照明・空・フォグ・ポストプロセス）
│   ├── Terrain.tsx      # 地形メッシュ + 水面シェーダー + 木
│   ├── Buildings.tsx    # 自動発展ビル（住宅/商業/工業）
│   ├── Tracks.tsx       # 線路レンダリング（レール + 枕木 + バラスト）
│   ├── Stations.tsx     # 駅（ホーム + 屋根 + 駅名標）
│   ├── Trains.tsx       # 列車（車体 + ヘッドライト）
│   ├── Subsidiaries.tsx # 子会社建物
│   └── Camera.tsx       # カメラ制御 + 車窓モード
├── game/                # ゲームロジック（レンダリング非依存）
│   ├── store.ts         # Zustand ストア（グローバル状態管理）
│   ├── types.ts         # 型定義（TrackSegment, Station, Train, Building等）
│   ├── constants.ts     # 定数（コスト、列車種別、建物サブタイプ）
│   ├── actions.ts       # アクション（線路敷設、駅建設、列車配置、子会社建設）
│   ├── terrain.ts       # 地形生成（Simplex Noise + 河川）
│   ├── cityDevelopment.ts # 自動都市発展ロジック
│   ├── simulation.ts    # 時間経過 + 日次財務処理
│   ├── trackUtils.ts    # 線路ユーティリティ（接続判定、駅検索）
│   └── saveLoad.ts      # セーブ/ロード + オートセーブ
├── ui/                  # React UIコンポーネント
│   ├── HUD.tsx          # ヘッドアップディスプレイ
│   ├── Toolbar.tsx      # ツールバー（建設ツール選択）
│   ├── StatsPanel.tsx   # 経営情報パネル
│   ├── FinancePanel.tsx # 財務詳細パネル
│   ├── MiniMap.tsx      # ミニマップ
│   ├── TimeControls.tsx # 時間操作（一時停止/速度変更）
│   ├── TitleScreen.tsx  # タイトル画面
│   ├── Tutorial.tsx     # チュートリアル
│   ├── HelpPanel.tsx    # ヘルプ（キーボードショートカット）
│   └── Notifications.tsx # 通知トースト
└── utils/               # ユーティリティ
    ├── colors.ts        # 色定数
    └── grid.ts          # グリッド座標ヘルパー
```

### 主要な設計判断

- **プロシージャル生成**: 全ての建物・列車・木をコードで生成（外部3Dモデル不使用）
- **Seeded Randomization**: `seededRandom(x, z)` で位置ベースの決定論的ランダム
- **A列車メカニクス**: 駅の乗降客数に基づく都市発展（距離・人口密度・交通利便性を考慮）
- **昼夜サイクル**: Sun-Preetham Sky Model + 動的ライティング
- **ポストプロセス**: ACES Filmic トーンマッピング + Bloom + Vignette + SMAA

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| 3Dレンダリング | Three.js / @react-three/fiber / @react-three/drei |
| ポストプロセス | @react-three/postprocessing |
| UI | React 18 + TypeScript |
| 状態管理 | Zustand |
| スタイリング | Tailwind CSS |
| ビルド | Vite |
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
# タイトル画面スキップ（自動プレイ）
open "http://localhost:5173/city-builder/?autoplay"

# スクリーンショット取得（Puppeteer + SwiftShader）
node scripts/screenshot.cjs /tmp/screenshot.png
```

## 開発履歴

| Version | 内容 |
|---------|------|
| v0.1 | プロジェクト初期構築（Vite + React + Three.js + Zustand） |
| v0.2 | グラフィックス大幅改善（プロシージャルビル・水面シェーダー・煙パーティクル） |
| Step 1 | A列車型アーキテクチャへリファクタ（地形生成、型システム、64×64グリッド） |
| Step 2 | 線路敷設・駅建設・列車運行 |
| Step 3 | 自動都市発展 + 昼夜サイクル |
| Step 4 | ビジュアル向上（窓テクスチャ・屋根・車窓モード・木） |
| Step 5 | 経営システム + 子会社 + セーブ/ロード |
| Step 6 | チュートリアル + タイトル画面 + ヘルプ |
| Step 7 | ビジュアル品質改善（影・空・水面・地形テクスチャ・フォグ） |

## TODO

- [ ] 水面シェーダー強化（リアルタイム反射・波）
- [ ] 地形テクスチャの更なる改善
- [ ] UIアイコンのブラッシュアップ
- [ ] パフォーマンス最適化（InstancedMesh、チャンクベースレンダリング）
- [ ] コード分割（現在バンドル ~1.4MB）
- [ ] 複数路線の分岐・合流
- [ ] 列車種別の追加（特急・各停）
- [ ] サウンドエフェクト
- [ ] モバイル対応

## ライセンス

MIT
