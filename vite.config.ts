import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { createReadStream, cpSync, copyFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const alphaTabDist = path.resolve(projectRoot, 'node_modules/@coderline/alphatab/dist')

const alphaTabRuntimeFiles = [
  'alphaTab.core.mjs',
  'alphaTab.worker.mjs',
  'alphaTab.worklet.mjs'
]

const contentTypes: Record<string, string> = {
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.sf2': 'audio/soundfont',
  '.sf3': 'audio/soundfont',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const alphaTabAssets = (): Plugin => ({
  name: 'tab-engine-alphatab-assets',
  configureServer(server) {
    server.middlewares.use('/alphatab', (req, res, next) => {
      const requestPath = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
      const filePath = path.resolve(alphaTabDist, requestPath.replace(/^[/\\]+/, ''))
      const relativeFilePath = path.relative(alphaTabDist, filePath)

      if (relativeFilePath.startsWith('..') || path.isAbsolute(relativeFilePath)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }

      try {
        const stats = statSync(filePath)
        if (!stats.isFile()) {
          next()
          return
        }

        const contentType = contentTypes[path.extname(filePath)]
        if (contentType) {
          res.setHeader('Content-Type', contentType)
        }
        createReadStream(filePath).pipe(res)
      } catch {
        next()
      }
    })
  },
  closeBundle() {
    const outDir = path.resolve(projectRoot, 'dist')
    const outAssetsDir = path.join(outDir, 'assets')
    mkdirSync(outAssetsDir, { recursive: true })

    alphaTabRuntimeFiles.forEach(fileName => {
      copyFileSync(path.join(alphaTabDist, fileName), path.join(outAssetsDir, fileName))
    })

    cpSync(path.join(alphaTabDist, 'font'), path.join(outDir, 'alphatab/font'), { recursive: true })
    cpSync(path.join(alphaTabDist, 'soundfont'), path.join(outDir, 'alphatab/soundfont'), { recursive: true })
  }
})

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), alphaTabAssets()],
  optimizeDeps: {
    exclude: ['@coderline/alphatab']
  }
})
