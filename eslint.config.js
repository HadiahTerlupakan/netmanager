// ESLint flat config for ESLint v9+
import next from 'eslint-config-next'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**'],
  },
]


