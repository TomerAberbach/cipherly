import type { Config } from 'tailwindcss'
import typographyPlugin from '@tailwindcss/typography'
import formsPlugin from '@tailwindcss/forms'

const config: Config = {
  content: [`./src/**/*.{js,cjs,mjs,ts,cts,mts,jsx,tsx}`],
  plugins: [typographyPlugin, formsPlugin],
}

export default config
