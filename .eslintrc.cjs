module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'test-results/', '*.min.js', 'app.js', 'env.js'],
  env: {
    es2021: true,
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended-legacy',
  ],
  rules: {
    'no-case-declarations': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    // Security rules - warn on potential issues, error on critical ones
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'off', // Not applicable in browser
    'security/detect-non-literal-require': 'off', // Using ES modules
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'warn',
  },
  overrides: [
    {
      files: ['scripts/**/*.js', '*.cjs'],
      env: { node: true, browser: false },
    },
    {
      files: ['tests/**/*.ts'],
      env: { jest: true, browser: true },
    },
    {
      files: ['playwright.config.ts', 'tests/e2e/**/*.ts'],
      env: { node: true, browser: false },
    },
  ],
};
