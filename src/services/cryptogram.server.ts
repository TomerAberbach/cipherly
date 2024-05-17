import {
  all,
  filter,
  first,
  flatMap,
  get,
  join,
  map,
  max,
  pipe,
  rangeUntil,
  reduce,
  sum,
  toGrouped,
  toMap,
  toSet,
} from 'lfi'
import { invariant } from '@epic-web/invariant'
import type { Dictionary } from './dictionary.server.ts'
import { computePattern } from './pattern.server.ts'
import { parseWords } from './words.server.ts'

/**
 * Finds possible ciphers for the given ciphertext, using the given dictionary.
 *
 * Returns after finding the given number of solutions, or earlier if the search
 * space was exhausted before finding the given number of solutions.
 */
const solveCryptogram = ({
  ciphertext,
  dictionary,
  maxSolutionCount,
  timeoutMs = Number.POSITIVE_INFINITY,
}: {
  ciphertext: string
  dictionary: Dictionary
  maxSolutionCount: number
  timeoutMs?: number
}): Map<string, Map<string, string>> => {
  const startTimeMs = Date.now()
  const solutions = new Map<
    string,
    { meanFrequency: number; cipher: Map<string, string> }
  >()

  const words = parseWords(ciphertext, dictionary.alphabet)
  const wordCandidatesStack: ReadonlyMap<string, ReadonlySet<string>>[] = [
    findWordCandidates(words, dictionary),
  ]
  do {
    const wordCandidates = pruneWordCandidates(
      wordCandidatesStack.pop()!,
      dictionary,
    )
    if (!wordCandidates) {
      continue
    }

    const maxCandidateWordsSize = pipe(
      wordCandidates,
      map(([, candidateWords]) => candidateWords.size),
      max,
      get,
    )
    if (maxCandidateWordsSize > 1) {
      wordCandidatesStack.push(
        ...partitionWordCandidates(wordCandidates).reverse(),
      )
      continue
    }

    const cipher = computeCipher(
      pipe(
        wordCandidates,
        map(
          ([word, candidateWords]) =>
            [word, get(first(candidateWords))] as const,
        ),
        reduce(toMap()),
      ),
    )
    const plaintext = decryptCiphertext(ciphertext, cipher)
    if (solutions.has(plaintext)) {
      continue
    }

    solutions.set(plaintext, {
      meanFrequency: computeMeanFrequency(plaintext, dictionary),
      cipher,
    })
  } while (
    solutions.size < maxSolutionCount &&
    wordCandidatesStack.length &&
    Date.now() - startTimeMs < timeoutMs
  )

  return pipe(
    [...solutions].sort(
      ([, solution1], [, solution2]) =>
        solution2.meanFrequency - solution1.meanFrequency,
    ),
    map(([plaintext, { cipher }]) => [plaintext, cipher] as const),
    reduce(toMap()),
  )
}

const findWordCandidates = (
  words: ReadonlySet<string>,
  dictionary: Dictionary,
): Map<string, ReadonlySet<string>> =>
  pipe(
    words,
    map(
      word =>
        [
          word,
          dictionary.patternWords.get(computePattern(word)) ?? new Set(),
        ] as const,
    ),
    reduce(toMap()),
  )

/**
 * Returns a copy of the given word candidates with pairwise incompatible
 * candidates removed, or undefined if any word has no candidates remaining.
 */
const pruneWordCandidates = (
  wordCandidates: ReadonlyMap<string, ReadonlySet<string>>,
  dictionary: Dictionary,
): Map<string, Set<string>> | undefined => {
  const letterCandidates = computeLetterCandidates(wordCandidates, dictionary)
  const prunedWordCandidates = pipe(
    wordCandidates,
    map(([word, candidateWords]): [string, Set<string>] => [
      word,
      pipe(
        candidateWords,
        filter(candidateWord =>
          pipe(
            zipWords(word, candidateWord),
            all(([letter, candidateLetter]) =>
              letterCandidates.get(letter)!.has(candidateLetter),
            ),
          ),
        ),
        reduce(toSet()),
      ),
    ]),
    reduce(toMap()),
  )
  return prunedWordCandidates.size > 0 &&
    all(([, candidateWords]) => candidateWords.size > 0, prunedWordCandidates)
    ? prunedWordCandidates
    : undefined
}

/**
 * Computes the letter candidates from the given word candidates.
 *
 * For example, given the following word candidates:
 * ```
 * MCDMRCNSFX => { DEADWEIGHT, DISDAINFUL, GREGARIOUS, PERPLEXITY }
 * MSCNPPRX => { AFLUTTER, BEDROOMS, GORILLAS, PROCEEDS, TYPHOONS }
 * ```
 *
 * `MCDMRCNSFX`'s candidates indicate `M` can decrypt to `D`, `G`, or `P`.
 * However, `MSCNPPRX`'s candidates indicate `M` can decrypt to `A`, `B`, `G`,
 * `P`, or `T`. Choosing to have `M` decrypt to a candidate which is not in both
 * sets will leave a word without a viable candidate. Therefore, `M` can only
 * decrypt to the intersection of these sets, namely `G` or `P`. This function
 * performs these intersections across all words for all letters.
 *
 * Consider also the following situation where it was deduced that:
 * * `M` can decrypt to `G` or `P`
 * * `L` can decrypt to `G` or `P`.
 * * `X` can decrypt to `G`, `P`, or `W`
 *
 * `X` cannot decrypt to `G` or `P` because if it did, then there would not be
 * enough letters left for `M` and `L` to decrypt to different letters, by
 * pigeonhole principle. So any letters, other than `M` and `L`, which have `G`
 * or `P` as possible candidates can have them removed as candidates. In fact,
 * whenever there are `n` letters which each decrypt to the same set of `n`
 * candidates, all other letters can have those candidates removed as
 * candidates. Consequently, if there are more than `n` letters with the same
 * set of `n` candidates, then there is no solution that satisfies the given
 * word candidates.
 */
const computeLetterCandidates = (
  wordCandidates: ReadonlyMap<string, ReadonlySet<string>>,
  dictionary: Dictionary,
): Map<string, Set<string>> => {
  const letterCandidates = pipe(
    wordCandidates,
    map(([word, candidateWords]) =>
      pipe(
        candidateWords,
        flatMap(candidateWord => zipWords(word, candidateWord)),
        reduce(toGrouped(toSet(), toMap())),
      ),
    ),
    reduce({
      create: () =>
        pipe(
          dictionary.alphabet,
          map(letter => [letter, new Set(dictionary.alphabet)] as const),
          reduce(toMap()),
        ),
      add: (letterCandidates1, letterCandidates2) =>
        pipe(
          letterCandidates1,
          map(([letter, candidateLetter]): [string, Set<string>] => [
            letter,
            intersection(
              candidateLetter,
              letterCandidates2.get(letter) ?? dictionary.alphabet,
            ),
          ]),
          reduce(toMap()),
        ),
    }),
  )

  let candidatesChanged
  do {
    // Group letters by their candidate sets. For example:
    // * 'X' -> { 'A', 'B' }
    // * 'Y' -> { 'A', 'B' }
    // * 'Z' -> { 'A' }
    // Becomes:
    // * { 'A', 'B' } -> { 'X', 'Y' }
    // * { 'A' } -> { 'Z' }
    const candidatesLetters = pipe(
      letterCandidates,
      map(([letter, candidateLetters]): [string, string] => [
        [...candidateLetters].sort().join(``),
        letter,
      ]),
      reduce(toGrouped(toSet(), toMap())),
    )

    // Subtracts letters from candidates which have been pigeonholed (see
    // function documentation above).
    candidatesChanged = false
    for (const [letter, candidateLetters] of letterCandidates) {
      for (const [candidateLettersString, letters] of candidatesLetters) {
        const currentCandidateLetters = new Set(candidateLettersString)
        if (
          (currentCandidateLetters.size === letters.size &&
            !letters.has(letter)) ||
          currentCandidateLetters.size < letters.size
        ) {
          for (const candidate of currentCandidateLetters) {
            const deleted = candidateLetters.delete(candidate)
            candidatesChanged ||= deleted
          }
        }
      }
    }
  } while (candidatesChanged)

  return letterCandidates
}

const intersection = <Value>(
  set1: ReadonlySet<Value>,
  set2: ReadonlySet<Value>,
): Set<Value> => {
  const intersection = new Set<Value>()
  for (const value of set1) {
    if (set2.has(value)) {
      intersection.add(value)
    }
  }
  return intersection
}

/**
 * Partitions the given word candidates map into multiple maps.
 *
 * The map is partitioned by producing maps where a single candidate is chosen
 * for words that had multiple candidates, except for potentially the last
 * returned map.
 *
 * The returned maps retain the full set of cross-word candidate combinations
 * from the original map and are ordered from highest theoretical frequency to
 * lowest.
 */
const partitionWordCandidates = (
  wordCandidates: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, Set<string>>[] => {
  const partitionedWordCandidates: Map<string, Set<string>>[] = []

  const remainingWordCandidates = pipe(
    wordCandidates,
    map(([word, wordCandidates]) => [word, new Set(wordCandidates)] as const),
    reduce(toMap()),
  )
  for (const [word, candidateWords] of remainingWordCandidates) {
    if (candidateWords.size === 1) {
      continue
    }

    const candidateWord = get(first(candidateWords))
    remainingWordCandidates.get(word)!.delete(candidateWord)

    const newWordCandidates = pipe(
      remainingWordCandidates,
      map(([word, wordCandidates]) => [word, new Set(wordCandidates)] as const),
      reduce(toMap()),
    )
    newWordCandidates.set(word, new Set([candidateWord]))
    partitionedWordCandidates.push(newWordCandidates)
  }

  partitionedWordCandidates.push(remainingWordCandidates)

  return partitionedWordCandidates
}

/**
 * Computes ciphertext letter to plaintext letter mappings (a cipher) from the
 * given ciphertext word to plaintext word mappings, which are assumed to be
 * pairwise compatible.
 */
const computeCipher = (wordCandidates: ReadonlyMap<string, string>) => {
  const cipher = pipe(
    wordCandidates,
    flatMap(([word, candidateWord]) => zipWords(word, candidateWord)),
    reduce(toGrouped(toSet(), toMap())),
    map(([letter, candidateLetters]) => {
      invariant(
        candidateLetters.size === 1,
        `Expected once candidate per letter`,
      )
      return [letter, get(first(candidateLetters))] as const
    }),
    reduce(toMap()),
  )
  invariant(
    new Set(cipher.values()).size === cipher.size,
    `Expected plaintext letters to be unique`,
  )
  return cipher
}

const zipWords = (word1: string, word2: string): Iterable<[string, string]> => {
  invariant(word1.length === word2.length, `Expected same length words`)
  return pipe(
    rangeUntil(0, word1.length),
    map(index => [word1[index]!, word2[index]!]),
  )
}

const decryptCiphertext = (
  ciphertext: string,
  cipher: Map<string, string>,
): string =>
  pipe(
    ciphertext,
    map(letter => cipher.get(letter) ?? letter),
    join(``),
  )

const computeMeanFrequency = (
  plaintext: string,
  dictionary: Dictionary,
): number => {
  const words = parseWords(plaintext, dictionary.alphabet)
  invariant(words.size > 0, `Expected at least one word`)

  const frequencySum = pipe(
    words,
    map(word => dictionary.wordFrequencies.get(word) ?? 0),
    sum,
  )
  const frequencyMean = frequencySum / words.size

  return frequencyMean
}

export default solveCryptogram
