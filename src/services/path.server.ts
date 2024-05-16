import { join } from 'node:path'

const createPath =
  (dirname: string) =>
  (...paths: readonly string[]) =>
    join(process.cwd(), dirname, ...paths)

export const privatePath = createPath(`private`)

export const publicPath = createPath(`public`)
