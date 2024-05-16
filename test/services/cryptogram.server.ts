import { fc, test } from 'tomer'
import solveCryptogram from '../../src/services/cryptogram.server.ts'
import { readDictionary } from '../../src/services/dictionary.server.ts'

const dictionary = await readDictionary()

test.prop([fc.stringOf(fc.constantFrom(...dictionary.alphabet, ` `))], {
  numRuns: 10_000,
})(`solveCryptogram does not crash`, ciphertext => {
  solveCryptogram({ ciphertext, dictionary, maxSolutionCount: 5 })
})
