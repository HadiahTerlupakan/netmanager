// ESLint flat config for ESLint v9+
import next from 'eslint-config-next'

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**'],
  },
]

export default config


