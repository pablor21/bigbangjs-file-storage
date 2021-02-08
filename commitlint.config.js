module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
      'scope-enum': [
        2,
        'always',
        [
          // workspace packages
          'core',
          'filesystem',
          'gcs',
          's3',
          'eslint',
          '*',
        ],
      ],
    },
  }