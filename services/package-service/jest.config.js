module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coverageDirectory: 'coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/models/**',
    '!src/utils/**'
  ],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true
}
