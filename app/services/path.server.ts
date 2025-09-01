import { join } from 'node:path'

export const privatePath = (...paths: readonly string[]) =>
  join(process.cwd(), `private`, ...paths)
