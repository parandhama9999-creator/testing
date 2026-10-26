import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        screen: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        Promise: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        Array: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        JSON: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        WebSocket: 'readonly',
        AbortController: 'readonly',
        ResizeObserver: 'readonly',
        Event: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-console': 'off',
    },
  },
];
