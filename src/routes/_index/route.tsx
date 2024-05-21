import { json } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
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
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSpinDelay } from 'spin-delay'
import magnifyingGlassSvgPath from './magnifying-glass.svg'
import loadingSvgPath from './loading.svg'
import solveCryptogram from '~/services/cryptogram.server.ts'
import { readDictionary } from '~/services/dictionary.server.ts'
import logoSvgPath from '~/private/images/logo-white.svg'

const IndexPage = () => (
  <>
    <Main />
    <Footer />
    <BackgroundLogo />
  </>
)

const Main = () => (
  <main className='z-10 flex flex-1 flex-col items-center justify-center gap-10 py-14 sm:py-20'>
    <Header />
    <Solver />
  </main>
)

const Header = () => (
  <header className='flex gap-3'>
    <h1 className='mt-1.5 text-right text-2xl font-medium tracking-[0.075em] sm:mt-1 sm:text-3xl'>
      Cipherly
    </h1>
    <img src={magnifyingGlassSvgPath} alt='' />
  </header>
)

const Solver = () => {
  const { submission, solutions } = useActionData<typeof action>() ?? {}
  const [form, fields] = useForm({
    lastResult: submission,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: formSchema }),
    constraint: getZodConstraint(formSchema),
  })
  const isSubmitting = useIsSubmitting()
  const preventSolvingIfSubmitting = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    e => {
      if (isSubmitting) {
        e.preventDefault()
      }
    },
    [isSubmitting],
  )

  return (
    <Form
      method='post'
      {...getFormProps(form)}
      className='flex w-full max-w-prose flex-1 flex-col items-center gap-4'
    >
      <div className='flex w-full flex-1 flex-col gap-1'>
        <label htmlFor={fields.text.id}>Ciphertext</label>
        <div className='relative flex flex-1'>
          <textarea
            {...getTextareaProps(fields.text)}
            placeholder='Enter your ciphertext...'
            className='w-full resize-none rounded-md border-0 bg-neutral-50 p-3 text-neutral-900 ring-neutral-500 focus:ring-neutral-500 focus-visible:ring-[3px]'
          />
          {solutions ? (
            <Solutions ciphertext={fields.text.value!} solutions={solutions} />
          ) : null}
          {isSubmitting ? <Loading /> : null}
        </div>
      </div>
      <input
        {...getInputProps(fields.action, { type: `hidden` })}
        defaultValue={Action.SOLVE}
      />
      <button
        onClick={preventSolvingIfSubmitting}
        aria-disabled={isSubmitting}
        className='rounded-md bg-gradient-to-br from-neutral-600 to-neutral-700 px-5 py-1.5 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 active:from-neutral-700 active:to-neutral-800'
      >
        Solve
      </button>
      <div id={fields.text.errorId}>{fields.text.errors}</div>
    </Form>
  )
}

const useIsSubmitting = () => {
  const navigation = useNavigation()
  const isSubmitting = useSpinDelay(navigation.state === `submitting`)
  return isSubmitting
}

const Loading = () => {
  const magnifyingFilterId = useId()
  return (
    <div className='absolute inset-0 flex items-center justify-center'>
      <span role='alert' className='text-xl font-medium text-neutral-900'>
        Solving...
      </span>
      <div className='absolute left-1/2 top-1/2 -translate-y-6'>
        <div className='relative inline-block animate-back-and-forth'>
          <div
            className='absolute right-0 top-0 -z-10 h-[52px] w-[52px] rounded-full'
            style={{ backdropFilter: `url(#${magnifyingFilterId})` }}
          />
          <img src={loadingSvgPath} alt='' />
        </div>
        <svg
          width='100%'
          xmlns='http://www.w3.org/2000/svg'
          preserveAspectRatio='none'
        >
          <defs>
            <filter id={magnifyingFilterId} color-interpolation-filters='sRGB'>
              <feImage
                href="data:image/svg+xml,%3Csvg width='128' height='128' viewBox='0 0 128 128' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23clip0_728_2)'%3E%3Crect width='128' height='128' fill='black'/%3E%3Cg style='mix-blend-mode:screen'%3E%3Crect width='128' height='128' fill='url(%23paint0_linear_728_2)'/%3E%3C/g%3E%3Cg style='mix-blend-mode:screen'%3E%3Crect width='128' height='128' fill='url(%23paint1_linear_728_2)'/%3E%3C/g%3E%3C/g%3E%3Cdefs%3E%3ClinearGradient id='paint0_linear_728_2' x1='0' y1='0' x2='128' y2='0' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23FF0000'/%3E%3Cstop offset='1' stop-color='%23FF0000' stop-opacity='0'/%3E%3C/linearGradient%3E%3ClinearGradient id='paint1_linear_728_2' x1='0' y1='0' x2='0' y2='128' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%230000FF'/%3E%3Cstop offset='1' stop-color='%230000FF' stop-opacity='0'/%3E%3C/linearGradient%3E%3CclipPath id='clip0_728_2'%3E%3Crect width='128' height='128' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E%0A"
                result='i'
              />
              <feDisplacementMap
                in='SourceGraphic'
                in2='i'
                xChannelSelector='R'
                yChannelSelector='B'
                scale='25'
              />
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  )
}

const Solutions = ({
  ciphertext,
  solutions,
}: {
  ciphertext: string
  solutions: Solution[]
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  useEffect(() => {
    dialogRef.current!.showModal()
  }, [])

  const { revalidate } = useRevalidator()
  const [solutionIndex, setSolutionIndex] = useState(0)
  const decrementSolutionIndex = useCallback(
    () => setSolutionIndex(solutionIndex => Math.max(0, solutionIndex - 1)),
    [],
  )
  const incrementSolutionIndex = useCallback(
    () =>
      setSolutionIndex(solutionIndex =>
        Math.min(solutionIndex + 1, solutions.length - 1),
      ),
    [solutions.length],
  )

  return (
    <dialog
      ref={dialogRef}
      className='flex flex-col space-y-5 rounded-md border-neutral-900 bg-neutral-900 p-8 text-neutral-50 backdrop:bg-neutral-950 backdrop:bg-opacity-35'
      onClose={revalidate}
    >
      <div className='flex items-center gap-5'>
        {solutions.length === 0 ? (
          <p className='text-center'>Couldn't find a solution!</p>
        ) : null}
        <form method='dialog' className='ml-auto flex'>
          <button className='ring-neutral-500 focus:outline-none focus-visible:ring-2'>
            <CloseIcon />
          </button>
        </form>
      </div>
      {solutions.length > 0 ? (
        <div className='flex flex-1 flex-col justify-center space-y-5'>
          <div className='space-y-5 overflow-auto text-center'>
            <p className='inline-block text-left'>{ciphertext}</p>
            <CipherTable cipher={solutions[solutionIndex]!.cipher} />
            <p className='inline-block text-left'>
              {solutions[solutionIndex]!.plaintext}
            </p>
          </div>
          <nav className='mx-auto flex w-min items-center gap-1.5'>
            <button
              type='button'
              onClick={decrementSolutionIndex}
              aria-disabled={solutionIndex === 0}
              className='h-6 w-6 ring-neutral-500 focus:outline-none focus-visible:ring-2 aria-disabled:opacity-40'
            >
              <ChevronLeftIcon />
            </button>
            <div className='whitespace-nowrap text-center'>
              {solutionIndex + 1} / {solutions.length}
            </div>
            <button
              type='button'
              onClick={incrementSolutionIndex}
              aria-disabled={solutionIndex === solutions.length - 1}
              className='h-6 w-6 ring-neutral-500 focus:outline-none focus-visible:ring-2 aria-disabled:opacity-40'
            >
              <ChevronRightIcon />
            </button>
          </nav>
        </div>
      ) : null}
    </dialog>
  )
}

const CloseIcon = () => (
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
)

const CipherTable = ({ cipher }: { cipher: Solution[`cipher`] }) => (
  <table className='mx-auto w-max table-fixed border text-center'>
    <thead>
      <tr>
        {Object.keys(cipher).map(ciphertextLetter => (
          <th key={ciphertextLetter} className='w-[2.5ch] border font-normal'>
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
)
const ChevronLeftIcon = () => (
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
)

const ChevronRightIcon = () => (
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
)

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
      . Magnifier&nbsp;effect&nbsp;by{` `}
      <ExternalLink href='https://shud.in'>Shu&nbsp;Ding</ExternalLink>.
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

const BackgroundLogo = () => (
  <img
    src={logoSvgPath}
    alt=''
    className='absolute bottom-0 right-3 w-1/5 min-w-48 max-w-72'
  />
)

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
