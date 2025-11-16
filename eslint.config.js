// @ts-check
// Temporary workaround for Node.js 20.9.0 compatibility
// TODO: Upgrade Node.js to 20.10.0+ to use @antfu/eslint-config
// For now, using a minimal ESLint config to avoid import attributes issue

export default [
  {
    ignores: ['dist/**', 'dist-electron/**', 'dist-server/**', 'release/**', 'node_modules/**', 'public/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
]
