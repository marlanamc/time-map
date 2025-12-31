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
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
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
