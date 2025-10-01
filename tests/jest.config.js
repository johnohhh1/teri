module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: [
    '../backend/src/**/*.js',
    '../mobile/src/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/*.config.js',
    '!**/dist/**'
  ],
  
  // Coverage thresholds (80% minimum per PRD)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Critical paths require higher coverage
    '../backend/src/services/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    '../backend/src/routes/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/setup/jest.setup.js'],
  
  // Module paths
  moduleNameMapping: {
    '^@backend/(.*)$': '<rootDir>/../backend/src/$1',
    '^@mobile/(.*)$': '<rootDir>/../mobile/src/$1',
    '^@tests/(.*)$': '<rootDir>/$1'
  },
  
  // Test timeout (important for API tests)
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Transform files
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ]
};
