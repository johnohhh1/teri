# TERI Model Test Suite

Comprehensive testing framework for the Truth Empowered Relationships (TERI) model system.

## Test Coverage Goals

- **80% minimum code coverage** across all modules
- **Performance validation** against PRD requirements
- **Security testing** for all attack vectors
- **E2E validation** of complete user journeys

## Test Structure

```
tests/
├── setup/
│   └── jest.setup.js           # Global test configuration
├── backend/
│   ├── api/                    # API endpoint tests
│   │   ├── auth.test.js        # Authentication flows
│   │   ├── translator.test.js  # TES/TEL translation
│   │   ├── mediator.test.js    # Audio processing
│   │   ├── training.test.js    # Training progression
│   │   ├── games.test.js       # Game mechanics
│   │   └── pairing.test.js     # Partner pairing
│   └── integration/
│       └── teri-model.test.js  # Complete TERI integration
├── mobile/
│   └── components/
│       ├── Dashboard.test.jsx  # Main dashboard UI
│       ├── Translator.test.jsx # Translation interface
│       └── Mediator.test.jsx   # Audio recording UI
├── e2e/
│   └── user-journey.test.js    # End-to-end scenarios
├── performance/
│   └── teri-performance.test.js # Performance benchmarks
├── security/
│   └── security-validation.test.js # Security tests
└── package.json                # Test dependencies & scripts
```

## Performance Requirements (PRD Section 8.1)

| Component | Requirement | Test Location |
|-----------|-------------|---------------|
| Authentication | <300ms (p95) | `backend/api/auth.test.js` |
| Training content | <500ms (p95) | `backend/api/training.test.js` |
| TES Translation | <3s (p95) | `backend/api/translator.test.js` |
| TEL Translation | <3s (p95) | `backend/api/translator.test.js` |
| Mediator processing | <10s for 60s audio | `backend/api/mediator.test.js` |
| Comprehension grading | <5s | `backend/api/training.test.js` |

## Security Testing Coverage

- **SQL Injection** prevention in all inputs
- **XSS Protection** across user-generated content
- **JWT Security** with proper expiration and validation
- **Rate Limiting** enforcement per PRD Appendix C
- **Data Privacy** between partners
- **Input Validation** and sanitization
- **Abuse Prevention** pattern detection

## Running Tests

### Full Test Suite
```bash
npm test
```

### By Category
```bash
npm run test:backend      # Backend API tests
npm run test:mobile       # React Native component tests
npm run test:integration  # TERI model integration
npm run test:e2e         # End-to-end user journeys
npm run test:performance # Performance benchmarks
npm run test:security    # Security validation
```

### Coverage Reports
```bash
npm run test:coverage    # Generate coverage report
npm run coverage:report  # Open HTML coverage report
```

### Continuous Integration
```bash
npm run test:ci         # CI-optimized test run
npm run test:validate   # Lint + test for PR validation
```

## E2E Testing with Detox

### Prerequisites
- iOS Simulator (for iOS tests)
- Android Emulator (for Android tests)
- Detox CLI: `npm install -g detox-cli`

### Setup
```bash
# Build iOS app for testing
npm run build:detox

# Run E2E tests
npm run e2e:ios     # iOS Simulator
npm run e2e:android # Android Emulator
```

## Test Data and Mocks

### Global Test Helpers
- `testHelpers.createTestUser()` - Generate test user data
- `testHelpers.createTestCouple()` - Create paired users
- `testHelpers.cleanDatabase()` - Clean test database
- `performanceHelpers.measureTime()` - Performance measurement

### Custom Jest Matchers
- `toMatchTESStructure()` - Validate TES translation format
- `toMatchTELStructure()` - Validate TEL listening format  
- `toBeWithinTimeLimit()` - Performance assertion

### Mock Services
- **OpenAI API** - Mocked for consistent LLM responses
- **AWS S3** - Mocked file upload/download
- **Audio Processing** - Mock transcription service
- **Email Service** - Mock email sending

## Performance Benchmarking

### Load Testing
- **100 concurrent users** for translation services
- **Database performance** under heavy load
- **Memory usage** monitoring during extended operation
- **Rate limiting** effectiveness

### Metrics Collection
- Response time percentiles (p50, p95, p99)
- Memory usage patterns
- Database query performance
- Error rates and recovery

## Security Test Scenarios

### Authentication Attacks
- Brute force login attempts
- Token manipulation and forgery
- Session hijacking attempts
- Password security validation

### Injection Attacks
- SQL injection in all input fields
- XSS in user-generated content
- Path traversal attempts
- File upload validation

### Privacy Violations
- Partner data access attempts
- Session data leakage
- Progress detail exposure
- Audio recording privacy

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:validate
      - run: npm run test:coverage
      - uses: coverallsapp/github-action@master
```

### Coverage Requirements
- **80% minimum** for merge approval
- **85% for critical services** (translator, mediator)
- **Security tests** must all pass
- **Performance benchmarks** must meet PRD requirements

## Debugging Tests

### Debug Individual Tests
```bash
npm test -- --testNamePattern="should translate reactive statement"
```

### Watch Mode
```bash
npm run test:watch
```

### Verbose Output
```bash
npm test -- --verbose
```

### Debug E2E Tests
```bash
detox test --loglevel verbose
```

## Contributing

1. **Write tests first** (TDD approach)
2. **Maintain 80%+ coverage** for new code
3. **Include performance tests** for new APIs
4. **Add security tests** for new user inputs
5. **Update E2E tests** for new user flows

### Test Writing Guidelines

1. **Descriptive test names** explaining what and why
2. **Arrange-Act-Assert** structure
3. **One assertion per test** when possible
4. **Clean up test data** in afterEach hooks
5. **Mock external dependencies** consistently

### Example Test Structure
```javascript
describe('Component/Feature', () => {
  beforeEach(async () => {
    // Setup test data
    await testHelpers.cleanDatabase();
  });
  
  describe('Functionality Group', () => {
    it('should perform expected behavior when given valid input', async () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toMatchExpectedStructure();
    });
  });
});
```

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Ensure test database is running
docker-compose up test-db
```

**Mock Service Failures**
```bash
# Clear Jest cache
npm test -- --clearCache
```

**E2E Test Flakiness**
```bash
# Reset simulators
xcrun simctl erase all
```

**Memory Issues**
```bash
# Run with more memory
node --max-old-space-size=4096 node_modules/.bin/jest
```

### Performance Issues
- Check database indices for test queries
- Monitor memory usage during long test runs
- Use `--runInBand` for debugging race conditions
- Profile test execution with `--logHeapUsage`

## Test Results Dashboard

Access test results and coverage reports:
- **Local**: `open coverage/lcov-report/index.html`
- **CI**: GitHub Actions artifacts
- **Coverage**: Coveralls integration

---

*This test suite ensures the TERI model meets all PRD requirements for performance, security, and functionality while maintaining high code quality standards.*
