import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Vitest reuses the app's Vite config (react + tailwind plugins, aliases, etc.)
// but drops VitePWA — it hooks into the build/dev-server lifecycle and can
// misbehave (or just add noise) when loaded under the jsdom test environment.
const filteredPlugins = (viteConfig.plugins ?? []).flat().filter((plugin) => {
  if (!plugin || typeof plugin !== 'object' || !('name' in plugin)) return true
  return !String(plugin.name).includes('vite-plugin-pwa')
})

export default mergeConfig(
  { ...viteConfig, plugins: filteredPlugins },
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
)
