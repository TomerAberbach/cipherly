import config from 'tomer/eslint'

export default [
  ...config,
  {
    rules: {
      'typescript/no-throw-literal': `off`,
      'typescript/explicit-module-boundary-types': `off`,
      'unicorn/filename-case': `off`,
    },
  },
  { ignores: [`remix.env.d.ts`] },
]
