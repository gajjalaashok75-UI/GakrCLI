import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://gakrcli.netlify.app',
  trailingSlash: 'always',
  integrations: [sitemap()],
})
