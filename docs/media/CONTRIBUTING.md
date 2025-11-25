# Contributing to StateSet MCP Server

Thank you for your interest in contributing to the StateSet MCP Server! We welcome contributions from the community and are grateful for your support.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## 🚀 Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/stateset-mcp-server.git
   cd stateset-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your environment**
   ```bash
   cp .env.example .env
   # Edit .env with your test API credentials
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

## 🔄 Development Process

### Branch Naming

- `feature/` - New features (e.g., `feature/add-bulk-operations`)
- `fix/` - Bug fixes (e.g., `fix/rate-limit-error`)
- `docs/` - Documentation updates (e.g., `docs/update-api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/improve-error-handling`)
- `test/` - Test additions or fixes (e.g., `test/add-integration-tests`)

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

Examples:
```bash
feat(tools): add bulk order creation tool
fix(api): handle rate limit errors gracefully
docs(readme): update installation instructions
```

## 🔀 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Run quality checks**
   ```bash
   npm run lint
   npm run format
   npm run typecheck
   npm test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Use a clear, descriptive title
   - Fill out the PR template completely
   - Link related issues
   - Request reviews from maintainers

### PR Requirements

- ✅ All tests pass
- ✅ Code coverage maintained or improved
- ✅ No linting errors
- ✅ Documentation updated
- ✅ Commit messages follow conventions
- ✅ PR description is complete

## 💻 Coding Standards

### TypeScript

- Use strict mode
- Prefer interfaces over types for object shapes
- Use explicit return types for functions
- Avoid `any` type - use `unknown` if necessary
- Use optional chaining and nullish coalescing

```typescript
// Good
interface UserData {
  id: string;
  name: string;
  email?: string;
}

function processUser(user: UserData): string {
  return user.email ?? 'No email provided';
}

// Bad
function processUser(user: any) {
  return user.email || 'No email provided';
}
```

### Error Handling

- Always handle errors explicitly
- Use custom error classes
- Provide helpful error messages
- Log errors appropriately

```typescript
// Good
try {
  const result = await apiCall();
  return result;
} catch (error) {
  if (error instanceof ApiError) {
    logger.error({ error, context: 'API call failed' });
    throw new UserFacingError('Unable to complete request');
  }
  throw error;
}
```

### Async/Await

- Always use async/await over promises
- Handle promise rejections
- Use `Promise.all()` for parallel operations

```typescript
// Good
const [orders, customers] = await Promise.all([
  fetchOrders(),
  fetchCustomers(),
]);

// Bad
fetchOrders().then(orders => {
  fetchCustomers().then(customers => {
    // ...
  });
});
```

## 🧪 Testing Guidelines

### Test Structure

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = createTestInput();
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle error case', async () => {
      // Test error scenarios
    });
  });
});
```

### Test Coverage

- Aim for 80%+ code coverage
- Test edge cases and error paths
- Use meaningful test descriptions
- Mock external dependencies

### Test Types

1. **Unit Tests** - Test individual functions/classes
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - Test complete workflows

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Include examples in comments
- Document complex algorithms
- Keep comments up-to-date

```typescript
/**
 * Creates a new order in the StateSet system
 * 
 * @param args - Order creation arguments
 * @param args.customer_email - Customer's email address
 * @param args.items - Array of order items
 * @returns The created order object
 * 
 * @example
 * ```typescript
 * const order = await createOrder({
 *   customer_email: 'customer@example.com',
 *   items: [{ item_id: '123', quantity: 2, price: 29.99 }]
 * });
 * ```
 */
export async function createOrder(args: CreateOrderArgs): Promise<Order> {
  // Implementation
}
```

### README Updates

- Update README.md for new features
- Add examples for new functionality
- Keep installation instructions current
- Update API reference

## 🤝 Community

### Getting Help

- 💬 [Discord Community](https://discord.gg/stateset)
- 📧 [Email Support](mailto:support@stateset.io)
- 🐛 [GitHub Issues](https://github.com/stateset/mcp-server/issues)

### Recognition

Contributors will be:
- Listed in our [Contributors](https://github.com/stateset/mcp-server/graphs/contributors) page
- Mentioned in release notes
- Given credit in documentation

## 🎉 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort in improving the StateSet MCP Server!

---

If you have any questions about contributing, please reach out to the maintainers or ask in our Discord community. 