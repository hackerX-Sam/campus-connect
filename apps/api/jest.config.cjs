module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['dist/**/*.js', '!dist/index.js', '!dist/lib/prisma.js'],
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 10,
      lines: 20,
      statements: 20,
    },
  },
};
