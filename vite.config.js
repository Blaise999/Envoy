import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ---------------------------------------------------------------------------
// Force the build process to exit once the bundle is fully written.
//
// On some cloud build environments (Vercel's included) `vite build` finishes
// successfully — it prints "✓ built in …" and the dist/ output is complete —
// but the Node process never exits, because a worker/handle from the build
// pipeline stays alive. The build command then never returns control, and the
// deploy hangs until it hits the platform timeout (~45 min on Vercel).
//
// closeBundle runs AFTER all output files are written, so exiting here cannot
// truncate the build. We add a small delay so the final logs flush first.
// Build-only (apply: 'build') so it never touches the dev server.
// ---------------------------------------------------------------------------
function forceExitAfterBuild() {
  return {
    name: 'force-exit-after-build',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      setTimeout(() => process.exit(0), 500)
    },
  }
}

// https://vite.dev
export default defineConfig({
  plugins: [react(), forceExitAfterBuild()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('leaflet')) {
            return 'mapping-engine'
          }
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    }
  }
})
