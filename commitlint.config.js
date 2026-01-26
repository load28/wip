module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'],
    ],
    'subject-empty': [2, 'never'],
    'subject-case': [0], // 한국어 커밋 메시지 허용
  },
};
