# 開発ガイド（引き継ぎドキュメント）

## 環境セットアップ

```bash
git clone https://github.com/office8-inc/city-builder.git
cd city-builder
npm install
npm run dev
```

Node.js 18+ 推奨。

## デプロイ

`main` ブランチへの push で GitHub Actions が自動的に GitHub Pages へデプロイ。

```yaml
# .github/workflows/deploy.yml
# Vite build → gh-pages ブランチへ deploy
```

**本番URL:** https://office8-inc.github.io/city-builder/  
**vite.config.ts** の `base: '/city-builder/'` はGitHub Pages用。変更時は注意。

## プロジェクト構造の理解

### 状態管理 (Zustand)

全てのゲーム状態は `src/game/store.ts` の単一ストアで管理:

```typescript
// 主要な状態
gameTime     // { year, month, day, hour, minute }
gamePhase    // 'title' | 'tutorial' | 'playing'
terrain      // TerrainTile[][] (64×64)
tracks       // TrackSegment[]
stations     // Station[]
trains       // Train[]
buildings    // Building[]
subsidiaries // Subsidiary[]
finance      // { cash, loans, quarterlyRevenue, ... }
```

### ゲームループ

`src/game/simulation.ts` の `SimulationLoop` が毎フレーム:
1. ゲーム時間を進める（speed倍速）
2. 列車を移動
3. 1日経過時に `processDailyFinance()` 実行
4. 一定間隔で `processCityDevelopment()` 実行

### 自動都市発展 (`cityDevelopment.ts`)

A列車のコアメカニクス:
- 各駅の `dailyPassengers` をもとに発展圧力を計算
- 駅から近いタイルほど発展しやすい（距離減衰）
- 建物は `level 1-3` で自動レベルアップ
- 種別（住宅/商業/工業）は周辺状況で決定

### 線路・駅・列車

- **線路**: 南北(N-S) or 東西(E-W) の直線のみ（斜めなし）
- **駅**: 線路上に配置、自動で日本語駅名を付与
- **列車**: 2駅以上の路線で自動往復運行（速度・定員は列車種別で異なる）

### 3Dレンダリング

- `Scene.tsx`: メインCanvas、照明（昼夜サイクル）、Sky、フォグ、ポストプロセス
- `Terrain.tsx`: 地形メッシュ（BufferGeometry + vertex colors）、水面（カスタムShaderMaterial）、木（InstancedMesh）
- `Buildings.tsx`: 建物はレベル・種別に応じたプロシージャル生成
- 全て外部モデルなし、コードで生成

## 現状の課題・改善ポイント

### ビジュアル（優先度高）
1. **水面シェーダー**: フレネル反射・波はコードにあるが、もっとリアルにできる
2. **地形の赤/ピンクのパッチ**: `terrain.ts` の `getTerrainColor` で `isDirt` 判定（`noise2 > 0.92`）。頻度や色の調整で改善可能
3. **木の見た目**: 球体+円柱のシンプルな形。LODや色バリエーション追加の余地あり
4. **UIアイコン**: 現在は絵文字ベース。SVGアイコンへの置き換え推奨

### 機能（優先度中）
5. **線路の分岐**: 現在は直線のみ。カーブ・分岐の追加が大きな機能改善
6. **列車種別**: `constants.ts` に定義済みだが、UIでの選択は未実装
7. **サウンド**: 完全未実装
8. **モバイル対応**: タッチ操作未対応

### パフォーマンス
9. **バンドルサイズ**: ~1.4MB（code-splitting推奨）
10. **InstancedMesh**: 遠方の建物はLOD + InstancedMeshで最適化可能
11. **チャンクベースレンダリング**: 64×64全タイルを常時レンダリングしている

## スクリーンショット自動テスト

```bash
# Puppeteer + SwiftShader (ソフトウェアGL) でスクショ取得
# ※ WSL2環境ではGPU非対応のため影が描画されない
node scripts/screenshot.cjs [出力パス] [URL]
```

**注意**: SwiftShader環境では影・Sky等のGPU依存エフェクトが正常に描画されない。
実際のブラウザ（GPU付き）での見た目とは異なる。

## コーディング規約

- TypeScript strict mode
- コンポーネント: 関数コンポーネント + hooks
- 状態: Zustand (`useGameStore`)
- スタイル: Tailwind CSS
- 3D: @react-three/fiber のJSX記法
- 日本語コメント推奨
