import readline from 'node:readline'
import { createGunzip } from 'node:zlib'
import { Agent } from 'node:http'
import {
  asAsync,
  eachAsync,
  filter,
  filterMapAsync,
  flatMap,
  flattenAsync,
  join,
  map,
  mapAsync,
  pipe,
  rangeTo,
  reduce,
  reduceAsync,
  toArray,
  toGrouped,
  toMap,
  toSet,
} from 'lfi'
import { got } from 'got'
import { parseWords } from '../src/services/words.server.ts'

const downloadNgramFrequencies = async (
  n: number,
): Promise<Map<string, number>> => {
  let count = 0
  const ngramFrequencies: Map<string, { year: number; frequency: number }> =
    await pipe(
      downloadNgrams(n),
      eachAsync(() => {
        count++
        if (count % 100_000 === 0) {
          console.error(count)
        }
      }),
      mapAsync(({ ngram, ...rest }) => [ngram, rest] as const),
      reduceAsync(
        toGrouped((ngram1, ngram2) => {
          if (ngram2.year > ngram1.year) {
            return ngram2
          }

          ngram1.frequency += ngram2.frequency
          return ngram1
        }, toMap()),
      ),
    )
  return pipe(
    [...ngramFrequencies].sort(([ngram1, data1], [ngram2, data2]) => {
      const frequencyDiff = data2.frequency - data1.frequency
      return frequencyDiff === 0 ? ngram1.localeCompare(ngram2) : frequencyDiff
    }),
    map(([ngram, { frequency }]) => [ngram, frequency] as const),
    reduce(toMap()),
  )
}

const downloadNgrams = (
  n: number,
): AsyncIterable<{
  ngram: string
  year: number
  frequency: number
}> =>
  pipe(
    downloadRawNgrams(n),
    filterMapAsync(data => {
      const [ngramString, yearString, frequencyString] = data.split(`\t`)
      const words = pipe(
        ngramString!.split(` `),
        map(word => join(``, parseWords(word.split(`_`)[0]!, alphabet))),
        filter(word => word.length > 0),
        reduce(toArray()),
      )
      if (words.length !== n) {
        return null
      }
      return {
        ngram: words.join(` `),
        year: parseInt(yearString!, 10),
        frequency: parseInt(frequencyString!, 10),
      }
    }),
  )

const downloadRawNgrams = (n: number): AsyncIterable<string> =>
  pipe(
    getNgramDownloadUrls(n),
    map(downloadUrl =>
      readline.createInterface({
        input: got
          .stream(downloadUrl, {
            agent: {
              http: new Agent({ keepAlive: true, keepAliveMsecs: 60 * 1000 }),
            },
          })
          .pipe(createGunzip()),
        crlfDelay: Infinity,
      }),
    ),
    asAsync,
    flattenAsync,
  )

const getNgramDownloadUrls = (n: number): Iterable<string> => {
  let filenames: Iterable<string> = alphabet
  if (n > 1) {
    filenames = flatMap(
      filename => map(letter => filename + letter, alphabet),
      filenames,
    )
  }
  return map(
    filename => getNgramDownloadUrl(n, filename.toLowerCase()),
    filenames,
  )
}

const alphabet = pipe(
  rangeTo(`A`.charCodeAt(0), `Z`.charCodeAt(0)),
  map(String.fromCharCode),
  reduce(toSet()),
)

const getNgramDownloadUrl = (n: number, letters: string): string =>
  `http://storage.googleapis.com/books/ngrams/books/googlebooks-eng-all-${n}gram-20120701-${letters}.gz`

const n = parseInt(process.argv[2]!, 10)
for (const [word, frequency] of await downloadNgramFrequencies(n)) {
  console.log(`${word},${frequency}`)
}
