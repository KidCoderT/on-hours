import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

type CssRule = { type: string; selectors: string[] }
type CssAtRule = { params: string; each: (fn: (node: CssRule) => void) => void; replaceWith: (nodes: unknown) => void; nodes: unknown }

/**
 * The site has a light/dark button, but the app's pill CSS follows the device through
 * `@media (prefers-color-scheme: dark)`. This rewrites every such block, the app's and the
 * site's, to follow `<html data-mode="dark">` instead, so one attribute switches everything.
 * index.html sets the attribute before first paint.
 */
const darkByAttribute = {
  postcssPlugin: 'dark-by-attribute',
  AtRule: {
    media(atRule: CssAtRule) {
      if (!/prefers-color-scheme:\s*dark/.test(atRule.params)) return
      atRule.each((node) => {
        if (node.type !== 'rule') return
        node.selectors = node.selectors.map((s) =>
          s.startsWith(':root') ? s.replace(':root', ':root[data-mode="dark"]') : `:root[data-mode="dark"] ${s}`,
        )
      })
      atRule.replaceWith(atRule.nodes)
    },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  // "as never": typed by hand above instead of adding postcss as a dependency just for its types.
  css: { postcss: { plugins: [darkByAttribute as never] } },
  resolve: {
    // The site renders the app's own pill and chart components, so they can never drift apart.
    alias: { '@app': fileURLToPath(new URL('../desktop/src', import.meta.url)) },
    // Those files sit next to desktop/node_modules; without this they would load a second React.
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: ['..'] } },
})
