import { nextTick } from 'node:process'
import memoize from 'memoize'

export const cache = <Value>(fn: () => Value): (() => Value) => {
  const cachedFn = memoize(fn)

  // Call and cache asynchronously to ensure dependencies are initialized.
  nextTick(cachedFn)
  return cachedFn
}
