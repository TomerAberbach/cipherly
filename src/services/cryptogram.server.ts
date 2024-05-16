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

const solveCryptogram = ({
  ciphertext,
  dictionary,
  maxSolutionCount,
}: {
  ciphertext: string
  dictionary: Dictionary
  maxSolutionCount: number
}): Map<string, Map<string, string>> => {
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
      const remainingWordToCandidates = pipe(
        wordCandidates,
        map(
          ([word, wordCandidates]) => [word, new Set(wordCandidates)] as const,
        ),
        reduce(toMap()),
      )
      const newWordsToCandidates: ReadonlyMap<string, ReadonlySet<string>>[] =
        []
      for (const [word, candidateWords] of remainingWordToCandidates) {
        if (candidateWords.size === 1) {
          continue
        }

        const candidateWord = get(first(candidateWords))
        remainingWordToCandidates.get(word)!.delete(candidateWord)

        const newWordToCandidates = pipe(
          remainingWordToCandidates,
          map(
            ([word, wordCandidates]) =>
              [word, new Set(wordCandidates)] as const,
          ),
          reduce(toMap()),
        )
        newWordToCandidates.set(word, new Set([candidateWord]))
        newWordsToCandidates.push(newWordToCandidates)
      }

      wordCandidatesStack.push(
        remainingWordToCandidates,
        ...newWordsToCandidates.reverse(),
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
  } while (solutions.size < maxSolutionCount && wordCandidatesStack.length)

  return pipe(
    [...solutions].sort(
      ([, solution1], [, solution2]) =>
        solution2.meanFrequency - solution1.meanFrequency,
    ),
    map(([plaintext, { cipher }]) => [plaintext, cipher] as const),
    reduce(toMap()),
  )
}

const computeCipher = (wordCandidates: ReadonlyMap<string, string>) => {
  const letterCandidates = pipe(
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
    new Set(letterCandidates.values()).size === letterCandidates.size,
    `Expected letter candidates to be disjoint`,
  )
  return letterCandidates
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
 * Returns the possible letter decryption mappings of this [Map] from ciphertext words
 * to plaintext candidates for those words.
 *
 * For example, given the following ciphertext words with plaintext candidates:
 * ```
 * "MCDMRCNSFX" -> { "deadweight", "disdainful", "gregarious", "perplexity" }
 * "MSCNPPRX" -> { "aflutter", "bedrooms", "gorillas", "proceeds", "typhoons" }
 * ```
 * `"MCDMRCNSFX"`'s candidates indicate `"M"` can decrypt to any character in the set `{ "d", "g", "p" }`.
 * However, "MSCNPPRX"'s candidates indicate `"M"` can decrypt to any character in the set `{ "a", "b", "g", "p", "t" }`.
 * Clearly, choosing to have `"M"` decrypt to a character which is not in both sets will leave a word without a viable
 * candidate. Therefore, `"M"` can only decrypt to the intersection of these sets, namely `{ "g", "p" }`.
 * This function performs these intersections across all words for all characters.
 *
 * Consider also the following situation where it was deduced that:
 * * `"M"` can decrypt to any character in the set `{ "g", "p" }`.
 * * `"L"` can decrypt to any character in the set `{ "g", "p" }`.
 * * `"X"` can decrypt to any character in the set `{ "g", "p", "w" }`.
 * Clearly, `"X"` cannot decrypt to `"g"` or `"p"` because if it did then there would not be enough
 * characters for `"M"` and `"L"` to decrypt to different characters, by pigeonhole principle. So
 * any characters, other than `"M"` and `"L"`, which have `"g"` or `"p"` as possible decryptions can have
 * them removed from their sets. In fact, whenever there are `n` characters which each decrypt to the same
 * set of `n` characters, all other characters can have that set subtracted from their possible decryptions.
 * Lastly, if more than `n` characters which decrypt to the same set of `n` characters then there is no
 * solution for the given mappings from ciphertext words to plaintext candidates.
 */
const computeLetterCandidates = (
  wordCandidates: ReadonlyMap<string, ReadonlySet<string>>,
  dictionary: Dictionary,
): Map<string, Set<string>> => {
  const letterCandidates = pipe(
    wordCandidates,
    map(([word, candidateWords]) =>
      // Get letter to candidate for this word based on its candidate words.
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

  let changed
  do {
    const candidatesLetters = pipe(
      letterCandidates,
      map(([letter, candidateLetters]): [string, string] => [
        [...candidateLetters].sort().join(``),
        letter,
      ]),
      reduce(toGrouped(toSet(), toMap())),
    )

    changed = false
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
            changed ||= deleted
          }
        }
      }
    }
  } while (changed)

  return letterCandidates
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

export default solveCryptogram
