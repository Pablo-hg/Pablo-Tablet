import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'

function developmentBaseVersion() {
  try {
    return execFileSync('git', ['describe', '--tags', '--match', 'v[0-9]*', '--abbrev=0', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().replace(/^v/, '')
  } catch {
    return null
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __DEVELOPMENT_BASE_VERSION__: JSON.stringify(developmentBaseVersion()) },
})
