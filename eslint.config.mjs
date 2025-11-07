// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // These rules control warnings about any:

    // no-explicit-any - Using any explicitly
    // no-unsafe-argument - Passing any as arguments
    // no-unsafe-assignment - Assigning any to variables
    // no-unsafe-call - Calling any typed values
    // no-unsafe-member-access - Accessing properties on any
    // no-unsafe-return - Returning any from functions

    // Turn off all of these to stop warnings related to any types.
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off', 
      '@typescript-eslint/no-unsafe-return': 'off', 
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },
);
