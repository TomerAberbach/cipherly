import type { Config } from 'tailwindcss'
import typographyPlugin from '@tailwindcss/typography'
import formsPlugin from '@tailwindcss/forms'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  content: [`./src/**/*.{js,cjs,mjs,ts,cts,mts,jsx,tsx}`],
  theme: {
    fontFamily: { sans: [`Saira`, ...defaultTheme.fontFamily.sans] },
  },
  plugins: [typographyPlugin, formsPlugin],
}

export default config
