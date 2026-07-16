import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/city-builder/',
  build: {
    rollupOptions: {
      output: {
        // three.js系とreact系をそれぞれ独立したvendorチャンクに分離し、
        // mainチャンクのサイズを抑える（アプリコードの変更時にvendorのキャッシュも効く）。
        // オブジェクト形式のmanualChunksはパッケージのバレルエントリしか拾えず、
        // react-dom/client のようなサブパスimportを取りこぼすため関数形式で解決済みidを判定する
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('three') || id.includes('postprocessing')) return 'vendor-three';
          if (id.includes('react') || id.includes('scheduler') || id.includes('zustand')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
})
