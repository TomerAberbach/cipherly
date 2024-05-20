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
import { map, pipe, reduce, toArray } from 'lfi'
import {
  Form,
  useActionData,
  useNavigation,
  useRevalidator,
} from '@remix-run/react'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Balancer } from 'react-wrap-balancer'
import { useSpinDelay } from 'spin-delay'
import clsx from 'clsx'
import magnifyingGlassSvgPath from './magnifying-glass.svg'
import loadingSvgPath from './loading.svg'
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
      src={logoSvgPath}
      alt=''
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
    <img src={magnifyingGlassSvgPath} alt='' />
  </header>
)

const CiphertextForm = () => {
  const { submission, solutions } = useActionData<typeof action>() ?? {}
  const [form, fields] = useForm({
    lastResult: submission,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: formSchema }),
    constraint: getZodConstraint(formSchema),
  })
  const navigation = useNavigation()
  const isSubmitting = useSpinDelay(navigation.state === `submitting`)

  return (
    <div className='relative flex w-full max-w-prose flex-1'>
      <Form
        method='post'
        {...getFormProps(form)}
        className='flex w-full flex-1 flex-col items-center gap-4'
      >
        <div className='flex w-full flex-1 flex-col gap-1'>
          <label htmlFor={fields.text.id}>Ciphertext</label>
          <div className='relative flex flex-1'>
            <textarea
              {...getTextareaProps(fields.text)}
              placeholder='Enter your ciphertext...'
              className='w-full flex-1 resize-none rounded-md border-0 bg-neutral-50 p-3 text-neutral-900 ring-neutral-500 focus:ring-neutral-500 focus-visible:ring-[3px]'
            />
            {solutions ? (
              <SolutionsView
                ciphertext={fields.text.value ?? ``}
                solutions={solutions}
              />
            ) : null}
            {isSubmitting ? <LoadingView /> : null}
          </div>
        </div>
        <input
          {...getInputProps(fields.action, { type: `hidden` })}
          defaultValue={Action.SOLVE}
        />
        <button className='focus:none rounded-md bg-gradient-to-br from-neutral-600 to-neutral-700 px-5 py-1.5 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500'>
          Solve
        </button>
        <div id={fields.text.errorId}>{fields.text.errors}</div>
      </Form>
    </div>
  )
}

const LoadingView = () => (
  <div className='absolute inset-0 flex items-center justify-center'>
    <span role='status' className='text-xl font-medium text-neutral-900'>
      Solving...
    </span>
    <div className='absolute left-1/2 top-1/2 -translate-y-6'>
      <img src={loadingSvgPath} alt='' className='animate-back-and-forth' />
    </div>
  </div>
)

const SolutionsView = ({
  ciphertext,
  solutions,
}: {
  ciphertext: string
  solutions: Solution[]
}) => {
  const { revalidate } = useRevalidator()
  const [solutionIndex, setSolutionIndex] = useState(0)
  const decrementSolutionIndex = useCallback(
    () => setSolutionIndex(solutionIndex => solutionIndex - 1),
    [],
  )
  const incrementSolutionIndex = useCallback(
    () => setSolutionIndex(solutionIndex => solutionIndex + 1),
    [],
  )

  if (solutions.length === 0) {
    return <div>Couldn't find a solution!</div>
  }

  const { plaintext, cipher } = solutions[solutionIndex]!
  return (
    <div className='absolute inset-10 flex flex-col space-y-5 rounded-md border-neutral-900 bg-neutral-900 p-8'>
      <button type='button' onClick={revalidate} className='ml-auto'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='currentColor'
          className='h-6 w-6'
          aria-label='Close'
        >
          <path
            fillRule='evenodd'
            d='M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z'
            clipRule='evenodd'
          />
        </svg>
      </button>
      <div className='flex flex-1 flex-col justify-center space-y-5'>
        <div className='space-y-5 overflow-auto text-center'>
          <p className='inline-block text-left'>{ciphertext}</p>
          <table className='mx-auto w-max table-fixed border text-center'>
            <thead>
              <tr>
                {Object.keys(cipher).map(ciphertextLetter => (
                  <th
                    key={ciphertextLetter}
                    className='w-[2.5ch] border font-normal'
                  >
                    {ciphertextLetter}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {Object.values(cipher).map(plaintextLetter => (
                  <td key={plaintextLetter} className='border'>
                    {plaintextLetter}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className='inline-block text-left'>{plaintext}</p>
        </div>
        <nav className='mx-auto flex w-min items-center gap-1.5'>
          <button
            type='button'
            onClick={decrementSolutionIndex}
            className={clsx(`h-6 w-6`, solutionIndex === 0 && `invisible`)}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='currentColor'
              className='h-6 w-6'
              aria-label='Previous'
            >
              <path
                fillRule='evenodd'
                d='M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z'
                clipRule='evenodd'
              />
            </svg>
          </button>
          <div className='w-[3ch] whitespace-nowrap text-center'>
            {solutionIndex + 1} / {solutions.length}
          </div>
          <button
            type='button'
            onClick={incrementSolutionIndex}
            className={clsx(
              `h-6 w-6`,
              solutionIndex === solutions.length - 1 && `invisible`,
            )}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='currentColor'
              className='h-6 w-6'
              aria-label='Next'
            >
              <path
                fillRule='evenodd'
                d='M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </nav>
      </div>
    </div>
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
    return json({ submission: submission.reply(), solutions: null })
  }

  const { text, action } = submission.value
  switch (action) {
    case Action.SOLVE:
      return json({
        submission: submission.reply(),
        solutions: await trySolveCryptogram(text),
      })
  }
}

const trySolveCryptogram = async (ciphertext: string): Promise<Solution[]> => {
  const dictionary = await readDictionary()
  const solutions = solveCryptogram({
    ciphertext,
    dictionary,
    maxSolutionCount: 5,
    timeoutMs: 6000,
  })
  return pipe(
    solutions,
    map(([plaintext, cipher]) => ({
      plaintext,
      cipher: Object.fromEntries(cipher),
    })),
    reduce(toArray()),
  )
}

type Solution = { plaintext: string; cipher: Record<string, string> }

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
