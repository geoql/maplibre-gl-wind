import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    format: ['esm'],
    platform: 'neutral',
    sourcemap: true,
    dts: true,
    deps: {
      neverBundle: [
        '@deck.gl/core',
        '@deck.gl/layers',
        '@luma.gl/core',
        '@luma.gl/engine',
        '@luma.gl/shadertools',
      ],
    },
  },
  lint: {
    plugins: ['typescript', 'import'],
    ignorePatterns: ['dist', 'node_modules', 'coverage', '*.config.ts'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'no-console': ['error', { allow: ['error'] }],
      'no-debugger': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'typescript/no-explicit-any': 'warn',
      'typescript/no-unused-vars': 'error',
      'typescript/no-floating-promises': 'error',
      'typescript/no-unsafe-assignment': 'warn',
      'import/no-cycle': 'error',
      'import/no-duplicates': 'error',
    },
  },
  fmt: {
    printWidth: 80,
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'all',
    bracketSpacing: true,
    arrowParens: 'always',
    endOfLine: 'lf',
    ignorePatterns: [
      'dist',
      'node_modules',
      'coverage',
      'pnpm-lock.yaml',
      '*.lock',
      'CHANGELOG.md',
      'jsr.json',
    ],
  },
});
