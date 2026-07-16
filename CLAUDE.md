# A列車で行こう シティビルダー

## プロジェクト概要
ブラウザで動作する3D都市開発シミュレーションゲーム。「A列車で行こう」シリーズにインスパイアされた、鉄道を中心とした都市経営ゲームです。

**本番URL:** https://office8-inc.github.io/city-builder/

## 技術スタック
- **Three.js** / **@react-three/fiber (R3F)** — 3Dレンダリング
- **React 18** + **TypeScript** — UI・アプリ構造
- **Vite** — ビルドツール
- **Zustand** — ゲーム状態管理
- **@react-three/drei** — R3Fヘルパー
- **Tailwind CSS** — UIスタイリング
- **simplex-noise** — 地形生成

## ディレクトリ構成

```
src/
├── main.tsx              # エントリーポイント
├── App.tsx               # ルートコンポーネント（ゲームフェーズ分岐）
├── components/           # 3Dコンポーネント
│   ├── Scene.tsx         # メインCanvas、照明、Sky、ポストプロセス
│   ├── Terrain.tsx       # 地形メッシュ（季節対応）、水面シェーダー、森林
│   ├── Tracks.tsx        # 線路描画（8方向）＋信号機メッシュ
│   ├── Stations.tsx      # 6種の駅メッシュ
│   ├── Trains.tsx        # 7種の車両メッシュ
│   ├── Buildings.tsx     # プロシージャル建物生成
│   ├── Subsidiaries.tsx  # 子会社メッシュ（工場、ホテル等）
│   ├── Roads.tsx         # 道路レンダリング
│   ├── Camera.tsx        # 3カメラモード（フリー/追尾/クォータービュー）
│   ├── Weather.tsx       # 天候エフェクト（雨粒子、雲）
│   └── GridHelper.tsx    # グリッドオーバーレイ
├── game/                 # ゲームロジック
│   ├── store.ts          # Zustand状態管理（メインストア）
│   ├── types.ts          # 全型定義
│   ├── constants.ts      # 定数（車両、駅、子会社、ツール定義等）
│   ├── actions.ts        # プレイヤーアクション（建設、撤去、売買等）
│   ├── simulation.ts     # 時間進行、日次財務、ラッシュアワー
│   ├── cityDevelopment.ts # 自動都市発展、相性システム、人口計算
│   ├── terrain.ts        # 地形生成（Simplex Noise）、季節別カラー
│   ├── trackUtils.ts     # 線路接続、信号対応移動、分岐ルーティング
│   ├── materials.ts      # 資材生産、地価計算、道路自動生成
│   ├── signals.ts        # ブロック信号システム
│   ├── scenarios.ts      # シナリオ定義（3本）
│   └── saveLoad.ts       # セーブ/ロード（3スロット、バージョン管理）
├── ui/                   # UIコンポーネント（2D）
│   ├── HUD.tsx           # メインHUDレイアウト
│   ├── Toolbar.tsx       # ツールバー（カテゴリ式）
│   ├── TitleScreen.tsx   # タイトル画面（シナリオ選択、ロード等）
│   ├── FinancePanel.tsx  # 財務ダッシュボード＋融資
│   ├── SchedulePanel.tsx # ダイヤ設定UI
│   ├── SettingsPanel.tsx # 設定画面（音量、ショートカット一覧）
│   ├── ScenarioPanel.tsx # シナリオ目標進捗表示
│   ├── MapEditor.tsx     # マップエディタ
│   └── ...               # その他（通知、ミニマップ、建物情報等）
└── utils/                # ユーティリティ
    ├── grid.ts           # グリッド座標変換
    └── audio.ts          # Web Audio API サウンドマネージャ
```

## コアシステム

### 1. マップ・地形（128×128タイル）
- Simplex Noiseによるプロシージャル地形生成（シード指定可）
- 地形種別: 平地、丘陵、山岳、水域、森林
- 季節で地形カラーが変化（桜→緑→紅葉→雪）

### 2. 線路・駅・列車
- **線路**: 8方向（N/NE/E/SE/S/SW/W/NW）、斜めはコスト1.5倍・長さ√2
- **駅**: 6種類（地上小/地上大/高架/始発/地下鉄/車両基地）
- **列車**: 7種類（普通/近郊/急行/気動車/貨物/新幹線/蒸気機関車）
- **ダイヤ**: 駅ごとに停車/通過/待機時間設定、循環/往復/片道モード
- **信号**: ブロック信号システム（赤/黄/緑）、赤信号で自動停止
- **分岐**: ダイヤの次駅方向に基づいてルーティング

### 3. 都市発展
- 駅の乗降客数に基づく発展圧力（距離減衰あり）
- 7業種の相性システム（`SYNERGY_MATRIX`）
- 建物自動レベルアップ（レベル4以上は近隣資材が必要）
- ラッシュアワー乗数: 7-9時 ×2.5、12-13時 ×1.3、17-20時 ×2.2

### 4. 経営システム
- **融資**: 4段階（1億/5億/10億/50億）、年利3-5%、元利均等返済
- **子会社**: 15種類（工場、ホテル、デパート、発電所 等）
- **土地売買**: 地価ベースの購入/売却、所有地からの不動産収入
- **株価**: 四半期EPS × P/E倍率（人口依存）
- **破産**: 資金<0 かつ 負債>最大負債比率 で経営破綻

### 5. 季節・天候
- 四季自動判定（月ベース）: 春/夏/秋/冬
- 天候: 晴/曇/雨（日次ランダム遷移）
- 雨エフェクト（2000粒子InstancedMesh）、雲エフェクト

### 6. カメラ
- **フリーカメラ**: OrbitControls（右ドラッグ回転、ホイールズーム）
- **追尾カメラ**: chase（後方追尾）/ cab（運転台視点）、Vキーで切替
- **クォータービュー**: 固定ピッチ30°、Q/Eで45°回転、WASD移動

## 状態管理（Zustand）

全てのゲーム状態は `src/game/store.ts` の単一ストアで管理。エンティティは `Map<string, T>` 形式。更新時はイミュータブルに新しい Map を生成すること。

```typescript
// 主要な状態
map              // MapTile[][] (128×128)
tracks           // Map<string, TrackSegment>  — 8方向線路
stations         // Map<string, Station>       — 6種の駅
trains           // Map<string, Train>         — 7種の車両
buildings        // Map<string, Building>      — 7業種の建物
subsidiaries     // Map<string, Subsidiary>    — 15種の子会社
signals          // Map<string, Signal>        — ブロック信号
finance          // Finance — 資金、負債、四半期収支、株価
loans            // Loan[] — 融資管理
ownedLand        // Set<string> — 所有地
gameTime         // { year, month, day, hour, minute }
season           // 'spring' | 'summer' | 'autumn' | 'winter'
weatherType      // 'clear' | 'cloudy' | 'rain'
gamePhase        // 'title' | 'tutorial' | 'playing' | 'gameover' | ...
```

## ゲームモード

| モード | 説明 |
|--------|------|
| 新しいゲーム | 通常プレイ（チュートリアル→本編） |
| シナリオ | 3本のプリセットシナリオ（初級/中級/上級） |
| コンストラクション | 資金無制限、破産無効 |
| マップエディタ | 地形ブラシで自由に地形編集 |

## 実装上の注意
- **3Dモデル**: 全て外部GLB/GLTFアセット（Kenney City Kit / KayKit）を使用
  - 建物: Kenney Suburban(住宅) / Commercial(商業) / Buildings(工業・文化) + KayKit-City(レジャー)
  - 駅: Kenney Buildings（platform_small/long/high, structure, hangar_largeA）
  - 列車: Kenney Train Kit（全7種: electric-city/square/double, diesel, bullet, locomotive, freight）
  - 線路: Kenney Train Kit（railroad-straight, rail-straight。曲線・分岐器の専用ツールは廃止済み）
  - 道路: KayKit City（接続性アルゴリズムで straight/corner/tsplit/junction を自動選択）
  - 子会社: Kenney Buildings + KayKit-City（全15種）
  - 信号: KayKit City trafficlight
  - 高架柱: Kenney Props supports_high
  - 森林: Kenney Nature（detail_forestA）
  - Kenney GLBモデルは外部テクスチャ `Textures/colormap.png` を参照（各モデルディレクトリに配置済み）
- InstancedMeshで大量オブジェクトのパフォーマンス確保
- 金額は整数で管理（浮動小数点誤差を回避）
- グリッド座標: (x, z)、yは高さ方向
- エンティティ更新は必ずイミュータブルに（`new Map` + スプレッド演算子）
- 日本語コメント推奨

## デプロイ
`main` ブランチへのプッシュで GitHub Actions が自動的に GitHub Pages へデプロイ。
`vite.config.ts` の `base: '/city-builder/'` は GitHub Pages 用。

## コマンド
- `npm run dev` — 開発サーバー起動
- `npm run build` — 本番ビルド
- `npm run preview` — 本番ビルドプレビュー

## スクリーンショットテスト
```
http://localhost:5173/city-builder/?autoplay
```
でタイトルスキップして直接ゲーム画面を表示可能。

## URL共有
- `?seed=数値` — マップシード指定
- `?scenario=ID` — シナリオ直接開始
- `?autoplay` — タイトルスキップ
