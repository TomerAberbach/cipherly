import { cssBundleHref } from '@remix-run/css-bundle'
import type { LinksFunction } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react'
import styles from './styles/index.css'
import logoBlackIcoPath from '~/private/images/logo-black.ico'
import logoWhiteIcoPath from '~/private/images/logo-white.ico'
import logoBlackSvgPath from '~/private/images/logo-black.svg'
import logoWhiteSvgPath from '~/private/images/logo-white.svg'

const App = () => (
  <html lang='en'>
    <head>
      <meta charSet='utf-8' />
      <meta
        name='viewport'
        content='width=device-width,initial-scale=1,viewport-fit=cover'
      />
      <Meta />
      <Links />
    </head>
    <body>
      <Outlet />
      <ScrollRestoration />
      <Scripts />
      <LiveReload />
    </body>
  </html>
)

export const links: LinksFunction = () => [
  { rel: `stylesheet`, href: styles },
  ...(cssBundleHref ? [{ rel: `stylesheet`, href: cssBundleHref }] : []),
  { rel: `preconnect`, href: `https://fonts.googleapis.com` },
  {
    rel: `preconnect`,
    href: `https://fonts.gstatic.com`,
    crossOrigin: `anonymous`,
  },
  {
    rel: `stylesheet`,
    href: `https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,100..900;1,100..900&display=swap`,
  },
  {
    rel: `icon`,
    href: logoBlackIcoPath,
    sizes: `any`,
    media: `(prefers-color-scheme: light)`,
  },
  {
    rel: `icon`,
    href: logoWhiteIcoPath,
    sizes: `any`,
    media: `(prefers-color-scheme: dark)`,
  },
  {
    rel: `icon`,
    href: logoBlackSvgPath,
    type: `image/svg+xml`,
    media: `(prefers-color-scheme: light)`,
  },
  {
    rel: `icon`,
    href: logoWhiteSvgPath,
    type: `image/svg+xml`,
    media: `(prefers-color-scheme: dark)`,
  },
]

export default App
