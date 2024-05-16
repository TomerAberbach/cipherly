import type { MetaFunction } from '@remix-run/node'
import { readDictionary } from '~/services/dictionary.server.ts'
import solveCryptogram from '~/services/cryptogram.server.ts'

export const meta: MetaFunction = () => [
  { title: `New Remix App` },
  { name: `description`, content: `Welcome to Remix!` },
]

export const loader = async () => {
  const dictionary = await readDictionary()
  console.log(`Read dictionary`)
  console.log(
    solveCryptogram({
      ciphertext: `A   WYOAYGY   IDBI   AI   AX   WYIIYL   IZ   IYOO   IDY

      ILKID   IDBU   B   OAY.   A    WYOAYGY  AI   AX   WYIIYL   IZ

      WY    NLYY    IDBU    IZ   WY   B    XOBGY.   BUT   A   WYOAYGY

      AI    AX   WYIIYL   IZ   QUZC   IDBU    WY   AEUZLBUI.




        `.toUpperCase(),
      dictionary,
      maxSolutionCount: 3,
    }),
  )
  return null
}

const IndexPage = () => (
  <div style={{ fontFamily: `system-ui, sans-serif`, lineHeight: `1.8` }}>
    <h1>Welcome to Remix</h1>
    <ul>
      <li>
        <a
          target='_blank'
          href='https://remix.run/tutorials/blog'
          rel='noreferrer'
        >
          15m Quickstart Blog Tutorial
        </a>
      </li>
      <li>
        <a
          target='_blank'
          href='https://remix.run/tutorials/jokes'
          rel='noreferrer'
        >
          Deep Dive Jokes App Tutorial
        </a>
      </li>
      <li>
        <a target='_blank' href='https://remix.run/docs' rel='noreferrer'>
          Remix Docs
        </a>
      </li>
    </ul>
  </div>
)

export default IndexPage
