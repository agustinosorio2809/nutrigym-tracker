import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // varsIgnorePattern solo cubre declaraciones var/let/const de nivel superior.
      // argsIgnorePattern hace falta aparte para params desestructurados (ej: un
      // componente Icon recibido por prop y usado solo como tag JSX <Icon />) —
      // sin esto, no-unused-vars no reconoce el uso como tag y lo marca sin usar.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      // El codebase declara los handlers de useEffect como function declarations
      // (hoisted) más abajo en el archivo, a propósito. react-hooks/immutability
      // (pensada para React Compiler) los marca como acceso antes de declarar,
      // pero funcionan bien en runtime por el hoisting.
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['api/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
