import ts from '@typed-sigterm/eslint-config';

export default ts({}, {
  rules: {
    'ts/no-redeclare': 'off',
  },
}, {
  // Robert UI 设计稿仅作参考，不参与 lint
  ignores: ['Robert UI/**'],
});
