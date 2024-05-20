import type { Config } from 'tailwindcss'
import typographyPlugin from '@tailwindcss/typography'
import formsPlugin from '@tailwindcss/forms'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  content: [`./src/**/*.{js,cjs,mjs,ts,cts,mts,jsx,tsx}`],
  theme: {
    fontFamily: { sans: [`Saira`, ...defaultTheme.fontFamily.sans] },
    extend: {
      keyframes: {
        'back-and-forth': {
          '0%, 100%': { transform: `translateX(-150%)` },
          '50%': { transform: `translateX(50%)` },
        },
      },
      animation: {
        'back-and-forth': `back-and-forth 2s ease-in-out infinite`,
      },
    },
  },
  plugins: [typographyPlugin, formsPlugin],
}

export default config
