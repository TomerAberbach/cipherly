import { fc, test } from '@fast-check/vitest'
import { expect } from 'vitest'
import solveCryptogram from '../../src/services/cryptogram.server.ts'
import { readDictionary } from '../../src/services/dictionary.server.ts'
import { parseWords } from '../../src/services/words.server.ts'

const dictionary = await readDictionary()

test.prop([fc.stringOf(fc.constantFrom(...dictionary.alphabet, ` `))], {
  numRuns: 100,
})(`solveCryptogram works`, ciphertext => {
  const solutions = solveCryptogram({
    ciphertext,
    dictionary,
    maxSolutionCount: 5,
  })

  expect(solutions.size).toBeGreaterThanOrEqual(0)
  expect(solutions.size).toBeLessThanOrEqual(5)
  for (const [plaintext, cipher] of solutions) {
    for (const word of parseWords(plaintext, dictionary.alphabet)) {
      expect(dictionary.wordFrequencies.has(word)).toBe(true)
    }

    expect(plaintext).toHaveLength(ciphertext.length)
    for (const [key, value] of cipher) {
      expect(dictionary.alphabet).toContain(key)
      expect(dictionary.alphabet).toContain(value)
    }
    expect([...new Set(cipher.values())]).toStrictEqual([...cipher.values()])
  }
})
