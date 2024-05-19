import { json } from '@remix-run/node'
import type { ActionFunctionArgs, MetaFunction } from '@remix-run/node'
import { z } from 'zod'
import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { map, pipe, reduce, toObject } from 'lfi'
import { Form, useActionData } from '@remix-run/react'
import type { ReactNode } from 'react'
import { Balancer } from 'react-wrap-balancer'
import magnifyingGlassSvgPath from './magnifying-glass.svg'
import solveCryptogram from '~/services/cryptogram.server.ts'
import { readDictionary } from '~/services/dictionary.server.ts'
import logoSvgPath from '~/private/images/logo-white.svg'

const IndexPage = () => (
  <>
    <main className='z-10 flex flex-1 flex-col items-center justify-center gap-10 py-14 sm:py-20'>
      <Header />
      <CiphertextForm />
    </main>
    <Footer />
    <img
      alt=''
      src={logoSvgPath}
      className='absolute bottom-0 right-3 w-1/5 min-w-48 max-w-72'
    />
  </>
)

const Header = () => (
  <header className='flex gap-3'>
    <Balancer
      as='h1'
      ratio={1}
      preferNative={false}
      className='mt-1.5 text-right text-2xl font-medium sm:mt-1 sm:text-3xl'
    >
      Cryptogram Solver
    </Balancer>
    <img alt='' src={magnifyingGlassSvgPath} />
  </header>
)

const CiphertextForm = () => {
  const { submission, solution } = useActionData<typeof action>() ?? {}
  const [form, fields] = useForm({
    lastResult: submission,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: formSchema }),
    constraint: getZodConstraint(formSchema),
  })

  return (
    <Form
      method='post'
      {...getFormProps(form)}
      className='flex w-full max-w-prose flex-1 flex-col items-center gap-4'
    >
      <div className='flex w-full flex-1 flex-col gap-1'>
        <label htmlFor={fields.text.id}>Ciphertext</label>
        <textarea
          {...getTextareaProps(fields.text)}
          placeholder='Enter your ciphertext...'
          className='w-full flex-1 resize-none rounded-md border-0 bg-neutral-50 p-3 text-neutral-900 ring-neutral-500 focus:ring-neutral-500 focus-visible:ring-[3px]'
        />
      </div>
      <input
        {...getInputProps(fields.action, { type: `hidden` })}
        defaultValue={Action.SOLVE}
      />
      <button className='focus:none rounded-md bg-gradient-to-br from-neutral-600 to-neutral-700 px-5 py-1.5 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500'>
        Solve
      </button>
      <div id={fields.text.errorId}>{fields.text.errors}</div>
      <pre>{solution ? JSON.stringify(solution, null, 2) : null}</pre>
    </Form>
  )
}

const Footer = () => (
  <footer className='z-10 pb-6 text-center text-xs leading-5 text-neutral-50 mix-blend-difference'>
    ©&nbsp;
    <ExternalLink href='https://tomeraberba.ch'>
      Tomer&nbsp;Aberbach
    </ExternalLink>
    . All&nbsp;rights&nbsp;reserved.
    <br />
    <span className='text-xs'>
      Images&nbsp;by{` `}
      <ExternalLink href='https://thenounproject.com/icon/search-6869091'>
        fahmistudio99
      </ExternalLink>
      &nbsp;and{` `}
      <ExternalLink href='https://thenounproject.com/icon/incognito-43596'>
        Alen&nbsp;Krummenacher
      </ExternalLink>
    </span>
  </footer>
)

const ExternalLink = ({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) => (
  <a
    href={href}
    target='_blank'
    rel='noopener noreferrer'
    className='font-medium underline'
  >
    {children}
  </a>
)

// TODO: Add all metadata.
export const meta: MetaFunction = () => [{ title: `Cryptogram Solver` }]

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: formSchema })
  if (submission.status !== `success`) {
    return json({ submission: submission.reply(), solution: null })
  }

  const { text, action } = submission.value
  switch (action) {
    case Action.SOLVE:
      return json({
        submission: submission.reply(),
        solution: await trySolveCryptogram(text),
      })
  }
}

const trySolveCryptogram = async (
  ciphertext: string,
): Promise<Record<string, Record<string, string>>> => {
  const dictionary = await readDictionary()
  const solutions = solveCryptogram({
    ciphertext,
    dictionary,
    maxSolutionCount: 5,
    timeoutMs: 6000,
  })
  return pipe(
    solutions,
    map(
      ([plaintext, cipher]) => [plaintext, Object.fromEntries(cipher)] as const,
    ),
    reduce(toObject()),
  )
}

const Action = { SOLVE: `solve` } as const
type Action = (typeof Action)[keyof typeof Action]

const [firstAction, ...restActions] = Object.values(Action)
const formSchema = z.object({
  text: z.string({
    // eslint-disable-next-line camelcase
    required_error: `Missing a ciphertext!`,
  }),
  action: z.enum([firstAction!, ...restActions]),
})

export default IndexPage
