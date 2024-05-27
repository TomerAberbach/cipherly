import fs from 'node:fs'
import readline from 'node:readline'
import {
  all,
  get,
  map,
  mapAsync,
  max,
  pipe,
  rangeTo,
  reduce,
  reduceAsync,
  toMap,
  toSet,
} from 'lfi'
import { invariant } from '@epic-web/invariant'
import { privatePath } from './path.server.ts'
import { computePatternWords } from './pattern.server.ts'
import { cache } from './cache.server.ts'

export const readDictionary = cache(async (): Promise<Dictionary> => {
  const alphabet = createAlphabet()
  const wordFrequencies = await readWordFrequencies(alphabet)
  console.log(process.memoryUsage())
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

const readWordFrequencies = async (
  alphabet: ReadonlySet<string>,
): Promise<Map<string, number>> => {
  console.log(process.memoryUsage())
  const wordFrequencies = await pipe(
    readline.createInterface({
      input: fs.createReadStream(privatePath(`frequencies/unigrams.csv`)),
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
    reduceAsync(toMap()),
  )

  verifyFrequenciesDescending(wordFrequencies)
  normalizeFrequencies(wordFrequencies)
  filterLowFrequencies(wordFrequencies)

  console.log(process.memoryUsage())
  return wordFrequencies
}

/** Verifies the given map is sorted in descending order by frequency. */
const verifyFrequenciesDescending = (
  frequencies: ReadonlyMap<string, number>,
): void => {
  let previousFrequency
  for (const frequency of frequencies.values()) {
    if (previousFrequency === undefined) {
      previousFrequency = frequency
      continue
    }

    invariant(
      frequency < previousFrequency,
      `Expected frequencies to be sorted in descending order`,
    )
  }
}

/** Modifies the map with frequencies normalized to the interval (0, 1]. */
const normalizeFrequencies = (frequencies: Map<string, number>): void => {
  const maxFrequency = pipe(
    frequencies,
    map(([, frequency]) => frequency),
    max,
    get,
  )
  invariant(maxFrequency > 0, `The maximum frequency must be greater than zero`)

  for (const [word, frequency] of frequencies) {
    frequencies.set(word, frequency / maxFrequency)
  }
}

/** Deletes entries from the map with low frequencies. */
const filterLowFrequencies = (frequencies: Map<string, number>): void => {
  for (const [word, frequency] of frequencies) {
    if (frequency <= 0.000_001) {
      frequencies.delete(word)
    }
  }
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
