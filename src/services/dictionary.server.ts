import fs from 'node:fs'
import readline from 'node:readline'
import {
  all,
  filter,
  get,
  map,
  mapAsync,
  max,
  pipe,
  rangeTo,
  reduce,
  reduceAsync,
  toArray,
  toGrouped,
  toMap,
  toSet,
} from 'lfi'
import { invariant } from '@epic-web/invariant'
import { privatePath } from './path.server.ts'
import { computePatternWords } from './pattern.server.ts'
import { cache } from './cache.server.ts'

export const readDictionary = cache(async (): Promise<Dictionary> => {
  const alphabet = createAlphabet()
  const wordFrequencies = pipe(
    await readWordFrequencies(alphabet),
    filter(([, frequency]) => frequency > 0.0001),
    reduce(toMap()),
  )
  return {
    alphabet,
    wordFrequencies,
    patternWords: computePatternWords(wordFrequencies.keys()),
  }
})

const createAlphabet = (): Set<string> =>
  pipe(
    rangeTo(`A`.charCodeAt(0), `Z`.charCodeAt(0)),
    map(String.fromCharCode),
    reduce(toSet()),
  )

// https://www.kaggle.com/datasets/rtatman/english-word-frequency
const readWordFrequencies = async (
  alphabet: ReadonlySet<string>,
): Promise<Map<string, number>> => {
  const wordFrequencies = await pipe(
    readline.createInterface({
      input: fs.createReadStream(privatePath(`unigram-frequencies.csv`)),
      crlfDelay: Infinity,
    }),
    mapAsync(line => {
      const cells = line.split(`,`)
      invariant(cells.length === 2, `Expected two cells per line`)

      let [word, frequencyString] = cells as [string, string]
      const frequency = parseInt(frequencyString, 10)
      invariant(
        !isNaN(frequency) && frequency > 0,
        `Expected frequency to be a positive integer`,
      )

      word = word.toUpperCase()
      invariant(
        all(letter => alphabet.has(letter), word),
        `Expected every letter of every word to be in the alphabet`,
      )

      return [word, frequency] as const
    }),
    reduceAsync(toGrouped(toArray(), toMap())),
  )

  return normalizeFrequencies(
    sortFrequenciesDescending(
      pipe(
        wordFrequencies,
        map(([word, frequencies]) => {
          invariant(frequencies.length === 1, `Each word should appear once`)
          return [word, frequencies[0]!] as const
        }),
        reduce(toMap()),
      ),
    ),
  )
}

/** Returns a copy of the given map sorted in descending order by frequency. */
const sortFrequenciesDescending = (
  frequencies: ReadonlyMap<string, number>,
): Map<string, number> =>
  new Map(
    [...frequencies].sort(
      ([, frequency1], [, frequency2]) => frequency2 - frequency1,
    ),
  )

/**
 * Returns a copy of the given map with frequencies normalized to the interval
 * (0, 1].
 */
const normalizeFrequencies = (
  frequencies: ReadonlyMap<string, number>,
): Map<string, number> => {
  const maxFrequency = pipe(
    frequencies,
    map(([, frequency]) => frequency),
    max,
    get,
  )
  invariant(maxFrequency > 0, `The maximum frequency must be greater than zero`)
  return pipe(
    frequencies,
    map(([word, frequency]) => [word, frequency / maxFrequency] as const),
    reduce(toMap()),
  )
}

export type Dictionary = {
  /** The set of letters in the alphabet in order. */
  readonly alphabet: ReadonlySet<string>

  /**
   * A map from dictionary words to usage frequency on the interval (0, 1].
   *
   * The map entries are sorted in descending order by frequency.
   */
  readonly wordFrequencies: ReadonlyMap<string, number>

  /**
   * A map from word pattern (see `computePattern`) to dictionary words that
   * follow the pattern.
   *
   * The map entries are sorted in descending order lexicographically by the
   * frequencies of the words in each entry. The words in each entry are sorted
   * in descending order by frequency.
   */
  readonly patternWords: ReadonlyMap<string, ReadonlySet<string>>
}
