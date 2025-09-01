import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { visualizer } from 'rollup-plugin-visualizer'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    visualizer({ emitFile: true }),
  ],
})
