# 開発ガイド（引き継ぎドキュメント）

## 環境セットアップ

```bash
git clone https://github.com/office8-inc/city-builder.git
cd city-builder
npm install
npm run dev
```

Node.js 18以上推奨。

## デプロイ

`main` ブランチへのプッシュで GitHub Actions が自動的に GitHub Pages へデプロイされます。

```yaml
# .github/workflows/deploy.yml
# Vite ビルド → gh-pages ブランチへデプロイ
```

**本番URL:** https://office8-inc.github.io/city-builder/
**vite.config.ts** の `base: '/city-builder/'` は GitHub Pages 用です。変更時は注意してください。

## プロジェクト構造

### ディレクトリ構成

```
src/
├── components/   # 3Dコンポーネント（Three.js / R3F）
│   ├── Scene.tsx       # メインCanvas、照明、Sky、ポストプロセス
│   ├── Terrain.tsx     # 地形メッシュ、水面シェーダー、木（InstancedMesh）
│   ├── Tracks.tsx      # 線路描画（8方向対応）＋信号機メッシュ
│   ├── Stations.tsx    # 6種の駅メッシュ
│   ├── Trains.tsx      # 7種の車両メッシュ
│   ├── Buildings.tsx   # プロシージャル建物生成
│   ├── Subsidiaries.tsx # 子会社メッシュ（工場、ホテル等）
│   ├── Roads.tsx       # 道路レンダリング
│   ├── Camera.tsx      # 3カメラモード（フリー/追尾/クォータービュー）
│   ├── Weather.tsx     # 天候エフェクト（雨粒子、雲）
│   └── GridHelper.tsx  # グリッドオーバーレイ
├── game/         # ゲームロジック
│   ├── store.ts        # Zustand状態管理（メインストア）
│   ├── types.ts        # 全型定義
│   ├── constants.ts    # 定数（車両、駅、子会社、ツール定義等）
│   ├── actions.ts      # プレイヤーアクション（建設、撤去、売買等）
│   ├── simulation.ts   # 時間進行、日次財務、ラッシュアワー
│   ├── cityDevelopment.ts # 自動都市発展、相性システム、人口計算
│   ├── terrain.ts      # 地形生成（Simplex Noise）、季節別カラー
│   ├── trackUtils.ts   # 線路接続、信号対応移動、分岐ルーティング
│   ├── materials.ts    # 資材生産、地価計算、道路自動生成
│   ├── signals.ts      # ブロック信号システム
│   ├── scenarios.ts    # シナリオ定義（3本）
│   └── saveLoad.ts     # セーブ/ロード（3スロット、バージョン管理）
├── ui/           # UIコンポーネント（2D）
│   ├── HUD.tsx         # メインHUDレイアウト
│   ├── Toolbar.tsx     # ツールバー（カテゴリ式）
│   ├── TitleScreen.tsx # タイトル画面（シナリオ選択、ロード等）
│   ├── FinancePanel.tsx # 財務ダッシュボード＋融資
│   ├── SchedulePanel.tsx # ダイヤ設定UI
│   ├── SettingsPanel.tsx # 設定画面（音量、ショートカット一覧）
│   ├── ScenarioPanel.tsx # シナリオ目標進捗表示
│   ├── MapEditor.tsx   # マップエディタ
│   └── ...             # その他（通知、ミニマップ、建物情報等）
└── utils/        # ユーティリティ
    ├── grid.ts         # グリッド座標変換
    └── audio.ts        # Web Audio API サウンドマネージャ
```

### 状態管理（Zustand）

全てのゲーム状態は `src/game/store.ts` の単一ストアで管理されています:

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

エンティティは全て `Map<string, T>` で管理されています。更新時はイミュータブルに新しい Map を生成してください（Bug #6 修正参照）。

### ゲームループ

`store.ts` の `tick()` が毎フレーム呼ばれます:

1. 信号状態を更新（`updateSignals`）
2. 列車を移動（信号・ダイヤ対応、ステーション停車処理）
3. 季節判定
4. 日次処理（毎日0:00）:
   - 天候遷移
   - 駅活性度更新
   - 資材生産処理
   - 都市自動発展（2日おき）
   - 地価更新
   - 道路自動生成
   - 労働力計算
   - 日次財務計算
   - 融資返済処理
   - 自動セーブ（5日おき）
5. 月次処理（毎月1日）:
   - 建物レベルアップ
   - 人口計算
   - 融資残月数デクリメント
   - 四半期報告（3ヶ月ごと）
   - 株価計算
   - 破産判定

### 自動都市発展（`cityDevelopment.ts`）

A列車のコアメカニクス:
- 駅の `dailyPassengers` をもとに発展圧力を計算
- 駅から近いタイルほど発展しやすい（距離減衰）
- 建物は自動レベルアップ（レベル4以上は近隣資材が必要）
- 7業種の相性システム（`SYNERGY_MATRIX`）が発展確率に影響
- ラッシュアワー乗数: 7-9時 ×2.5、12-13時 ×1.3、17-20時 ×2.2

### 線路・駅・列車

- **線路**: 8方向（N/NE/E/SE/S/SW/W/NW）対応。斜めセグメントはコスト1.5倍、長さ√2
- **駅**: 6種類（地上小/地上大/高架/始発/地下鉄/車両基地）
- **列車**: 7種類（普通/近郊/急行/気動車/貨物/新幹線/蒸気機関車）
- **ダイヤ**: 駅ごとに停車/通過/待機時間設定、循環/往復/片道モード
- **信号**: ブロック信号システム（赤/黄/緑）、赤信号で自動停止
- **分岐**: ダイヤの次駅方向に基づいてルーティング

### 経営システム

- **融資**: 4段階（1億/5億/10億/50億）、年利3-5%、元利均等返済
- **子会社**: 15種類（工場、ホテル、デパート、発電所、車両基地 等）
- **土地売買**: 地価ベースの購入/売却、所有地からの不動産収入
- **株価**: 四半期EPS × P/E倍率（人口依存）
- **破産**: 資金<0 かつ 負債>最大負債比率 で経営破綻

### 3Dレンダリング

- 全て外部モデルなし、コードでプロシージャル生成
- `Terrain.tsx`: BufferGeometry + vertex colors（季節対応）、カスタム水面シェーダー
- `ForestInstances`: InstancedMesh で森林（季節別カラー変化）
- `Buildings.tsx`: レベル・種別に応じた建物メッシュ
- `Trains.tsx`: 車両種別ごとの固有メッシュ（新幹線ノーズ、SLボイラー等）
- `Weather.tsx`: 雨（2000粒子 InstancedMesh）、雲（半透明球体）
- ポストプロセス: Bloom、Vignette、SMAA

### カメラモード

- **フリーカメラ**: OrbitControls（右ドラッグ回転、ホイールズーム）
- **追尾カメラ**: chase（後方追尾）/ cab（運転台視点）、Vキーで切替
- **クォータービュー**: 固定ピッチ30°、Q/Eで45°回転、WASD移動

## ゲームモード

| モード | 説明 |
|--------|------|
| 新しいゲーム | 通常プレイ（チュートリアル→本編） |
| シナリオ | 3本のプリセットシナリオ（初級/中級/上級） |
| コンストラクション | 資金無制限、破産無効 |
| マップエディタ | 地形ブラシで自由に地形編集 |

### URL共有

`?seed=数値` でマップシード指定、`?scenario=ID` でシナリオ直接開始。
`?autoplay` でタイトルスキップ。

## キーボードショートカット

| キー | 機能 |
|------|------|
| Space | 一時停止/再開 |
| 1-5 | 速度変更 |
| F | 財務パネル |
| H / ? | ヘルプ |
| T | 車窓モード切替 |
| V | 視点切替（フリー↔クォータービュー / chase↔cab） |
| Q / E | クォータービュー回転 |
| Tab | 列車切替（追尾モード中） |
| S | セーブ |
| L | ロード |
| Esc | パネル閉じる / ツール解除 |

## セーブデータ

- 3スロット対応（localStorage）
- バージョン管理（v1→v2自動マイグレーション）
- エンティティIDカウンタも永続化
- 自動セーブ: ゲーム内5日おき

## コーディング規約

- TypeScript strict mode
- コンポーネント: 関数コンポーネント + hooks
- 状態管理: Zustand（`useGameStore`）
- スタイル: Tailwind CSS
- 3D: @react-three/fiber のJSX記法
- エンティティ更新: イミュータブル（`new Map` + スプレッド演算子）
- 日本語コメント推奨

## スクリーンショットテスト

Playwright MCP で動作確認:
```
http://localhost:5173/city-builder/?autoplay
```
でタイトルスキップして直接ゲーム画面を表示できます。
