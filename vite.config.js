import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [nodePolyfills()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['xrpl', 'xrpl-accountlib'],
  },
});