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
import solveCryptogram from '~/services/cryptogram.server.ts'
import { readDictionary } from '~/services/dictionary.server.ts'

const IndexPage = () => {
  const { submission, solution } = useActionData<typeof action>() ?? {}
  const [form, fields] = useForm({
    lastResult: submission,
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: formSchema }),
    constraint: getZodConstraint(formSchema),
  })

  return (
    <div>
      <h1>Cryptogram</h1>
      <Form method='post' {...getFormProps(form)}>
        <div>
          <label htmlFor={fields.text.id}>Text</label>
          <textarea {...getTextareaProps(fields.text)} />
          <div id={fields.text.errorId}>{fields.text.errors}</div>
        </div>
        <input
          {...getInputProps(fields.action, { type: `hidden` })}
          defaultValue={Action.SOLVE}
        />
        <button>Submit</button>
        <pre>{solution ? JSON.stringify(solution, null, 2) : null}</pre>
      </Form>
    </div>
  )
}

export const meta: MetaFunction = () => [
  { title: `New Remix App` },
  { name: `description`, content: `Welcome to Remix!` },
]

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

const Action = {
  SOLVE: `solve`,
} as const
type Action = (typeof Action)[keyof typeof Action]

const [firstAction, ...restActions] = Object.values(Action)
const formSchema = z.object({
  text: z.string(),
  action: z.enum([firstAction!, ...restActions]),
})

export default IndexPage
