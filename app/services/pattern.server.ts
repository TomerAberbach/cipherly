import { join, map, pipe, reduce, toGrouped, toMap, toSet, unique } from 'lfi'

/**
 * Returns a map from word pattern (see {@link computePattern}) to words from
 * the given iterable that follow the pattern.
 */
export const computePatternWords = (
  words: Iterable<string>,
): Map<string, Set<string>> =>
  pipe(
    words,
    map(word => [computePattern(word), word] as const),
    reduce(toGrouped(toSet(), toMap())),
  )

/**
 * Returns the canonical pattern string of `word`.
 *
 * For example, both `computePattern('SEEN')` and `computePattern('ROOT')`
 * yield `'ABBC'`.
 */
export const computePattern = (word: string) => {
  let maxLetterCode = `A`.charCodeAt(0)
  const letters = pipe(
    word,
    unique,
    map((letter): [string, string] => [
      letter,
      String.fromCharCode(maxLetterCode++),
    ]),
    reduce(toMap()),
  )

  return pipe(
    word,
    map(letter => letters.get(letter)!),
    join(``),
  )
}
