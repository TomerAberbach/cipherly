import { filter, filterMap, flatMap, join, pipe } from 'lfi'
import { ParseEnglish } from 'parse-english'
import { visit } from 'unist-util-visit'

/**
 * Parses the unique set of words in the given text and normalizes and filters
 * them to the given alphabet.
 */
export const parseWords = (
  text: string,
  alphabet: ReadonlySet<string>,
): Set<string> => {
  const words = new Set<string>()
  visit(englishParser.parse(text), node => {
    if (node.type !== `WordNode`) {
      return
    }

    const word = pipe(
      node.children,
      filterMap(child => (child.type === `TextNode` ? child.value : null)),
      flatMap(text =>
        filter(letter => alphabet.has(letter), text.toUpperCase()),
      ),
      join(``),
    )
    if (!word) {
      return
    }

    words.add(word)
  })
  return words
}

const englishParser = new ParseEnglish()
