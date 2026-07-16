import * as THREE from 'three';

// 地下区間（トンネル）演出の共通ヘルパー。
//
// drei の <Clone> はデフォルトでは material をシャロー（同一参照）で使い回すため、
// 地下線路・地下区間走行中の列車だけを半透明にしようとして material を直接
// mutate すると、同じGLTFモデルを共有する他の地上インスタンスまで巻き込んで
// 汚染してしまう。ここでは three.js の Object3D.clone(true) + material.clone()
// で完全に独立したコピーを作ってから調整することで、この問題を避ける。

const UNDERGROUND_OPACITY = 0.4;
const UNDERGROUND_DARKEN = 0.4;

function isMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  return (obj as THREE.Mesh).isMesh === true;
}

/**
 * オブジェクトツリーを複製し、含まれる全メッシュのマテリアルも個別に複製した
 * 独立コピーを返す。以降このコピーのマテリアルをどれだけ書き換えても、
 * 複製元（GLTFキャッシュの共有シーン）や他インスタンスには影響しない。
 */
export function cloneWithOwnMaterials<T extends THREE.Object3D>(
  object: T,
  opts?: { castShadow?: boolean; receiveShadow?: boolean },
): T {
  const clone = object.clone(true) as T;
  clone.traverse(node => {
    if (!isMesh(node)) return;
    if (opts?.castShadow) node.castShadow = true;
    if (opts?.receiveShadow) node.receiveShadow = true;
    if (Array.isArray(node.material)) {
      node.material = node.material.map(m => m.clone());
    } else if (node.material) {
      node.material = node.material.clone();
    }
  });
  return clone;
}

function applyUndergroundTint(mesh: THREE.Mesh, enabled: boolean) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (!mat) continue;
    const m = mat as THREE.Material & { color?: THREE.Color; opacity: number; transparent: boolean };
    if (m.userData.baseOpacity === undefined) {
      m.userData.baseOpacity = m.opacity;
      m.userData.baseTransparent = m.transparent;
      if (m.color) m.userData.baseColorHex = m.color.getHex();
    }
    if (enabled) {
      m.transparent = true;
      m.opacity = UNDERGROUND_OPACITY;
      if (m.color) m.color.setHex(m.userData.baseColorHex).multiplyScalar(UNDERGROUND_DARKEN);
    } else {
      m.transparent = m.userData.baseTransparent;
      m.opacity = m.userData.baseOpacity;
      if (m.color && m.userData.baseColorHex !== undefined) m.color.setHex(m.userData.baseColorHex);
    }
  }
}

/**
 * 静的なオブジェクト（地下線路・地下鉄駅の地下ホーム等）用: 複製と同時に
 * 半透明・暗色トーンを焼き込んだコピーを返す。ランタイムで切り替える必要が
 * 無いものはこちらを使う。
 */
export function tintUndergroundStatic<T extends THREE.Object3D>(object: T): T {
  const clone = cloneWithOwnMaterials(object);
  clone.traverse(node => {
    if (isMesh(node)) applyUndergroundTint(node, true);
  });
  return clone;
}

/**
 * 動的トグル用: 列車が地下区間へ出入りする際に呼ぶ。対象ツリーは事前に
 * cloneWithOwnMaterials 等でインスタンス専有のマテリアルを持っている前提
 * （そうでないと他インスタンスを汚染する）。
 */
export function setUndergroundTint(root: THREE.Object3D, enabled: boolean) {
  root.traverse(node => {
    if (isMesh(node)) applyUndergroundTint(node, enabled);
  });
}
