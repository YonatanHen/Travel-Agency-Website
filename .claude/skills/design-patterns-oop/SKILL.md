---
name: design-patterns-oop
description: Apply SOLID principles, design patterns, and clean architecture to backend code. Think about separation of concerns, dependency injection, abstraction layers, and maintainable design before writing code. Use this when implementing new features, refactoring, or reviewing code structure in the microservices. This is a portfolio project - demonstrate senior-level architecture skills.
---

## When to Use This Skill

Invoke this skill when:
- Designing a new service or adding significant features
- Refactoring existing code to improve architecture
- Implementing business logic with multiple dependencies
- You're unsure about code organization or layering
- Writing code that could benefit from patterns (repository, factory, strategy)
- Setting up dependency injection or abstraction layers
- Preparing the project for portfolio presentation

**Do NOT use for**: Simple CRUD operations that follow established patterns, minor bug fixes, frontend changes.

## Mindset: Design First

**Before writing any code, ask:**
1. What is the responsibility of this component?
2. How will it change in the future? (Open/Closed Principle)
3. What are the dependencies? Can they be inverted? (Dependency Inversion)
4. Is this cohesive? Single responsibility?
5. Will this be testable? (Mockable dependencies)
6. How does this fit into the layered architecture?

## SOLID Principles

Always apply these fundamental principles:

### Single Responsibility Principle (SRP)
Each module/class should have one reason to change. Extract responsibilities into separate services.

**Bad:** Route handler does validation, DB ops, email, logging all in 50 lines.

**Good:** Route delegates to UserService → EmailService → Validation rules separate.

### Open/Closed Principle (OCP)
Modules should be open for extension, closed for modification. Use composition and inheritance strategically.

```javascript
class ServiceClient {
  constructor(baseURL) {
    this.axios = axios.create({ baseURL, timeout: 5000 })
  }
  async request(method, path, data = null) {
    return (await this.axios[method](path, data)).data
  }
}

class UserServiceClient extends ServiceClient {
  async getUser(userId) {
    return this.request('get', `/users/${userId}`)
  }
}
```

### Liskov Substitution Principle (LSP)
Subtypes must be substitutable for their base types. Any code using a base class should work with derived classes.

```javascript
class NotificationSender {
  async send(message) { throw new Error('Override') }
}
class EmailSender extends NotificationSender {
  async send(message) { /* email implementation */ }
}
class SMSSender extends NotificationSender {
  async send(message) { /* SMS implementation */ }
}
```

### Interface Segregation Principle (ISP)
Clients shouldn't depend on interfaces they don't use. Create focused interfaces/repositories.

```javascript
// Good: Segregated by responsibility
class UserRepository { async findById() {} async save() {} }
class OrderRepository { async findByUser() {} async create() {} }
class UserService {
  constructor(userRepository) { /* only depends on UserRepository */ }
}
```

### Dependency Inversion Principle (DIP)
Depend on abstractions, not concretions. Use dependency injection.

```javascript
// Abstraction
class IUserRepository {
  async findById(id) { throw new Error('Not implemented') }
  async save(user) { throw new Error('Not implemented') }
}

// Implementation
class MongoUserRepository extends IUserRepository {
  async findById(id) {
    return await this.User.findById(id)
  }
}

// Service depends on abstraction (injected)
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository
  }
}

// Usage: inject concrete implementation
const userRepo = new MongoUserRepository()
const userService = new UserService(userRepo)
```

## Layered Architecture (Clean/Hexagonal)

Every microservice must follow this structure:

```
services/<service-name>/src/
├── routes/              # HTTP layer (presenters)
│   └── auth.js         # Express routes, validation, response formatting
├── services/            # Business logic layer (use cases)
│   └── userService.js  # Core application logic
├── repositories/        # Persistence layer (data access)
│   └── userRepository.js
├── models/              # Domain entities + Mongoose schemas
│   └── User.js
├── middleware/          # Cross-cutting concerns (auth, rate-limit)
└── utils/              # Pure functions, helpers, validators
```

**Dependency flow:** Routes → Services → Repositories → Models
**Never** bypass layers (e.g., routes → models directly).

### Layered Example

```javascript
// routes/auth.js (HTTP layer only)
router.post('/sign-up', validateSignup, async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body)
    res.status(201).json({
      id: user.id,
      email: user.email,
      token: generateToken(user)
    })
  } catch (error) {
    next(error)
  }
})

// services/userService.js (Business logic)
class UserService {
  constructor(userRepository, emailService) {
    this.userRepository = userRepository
    this.emailService = emailService
  }

  async createUser(data) {
    const existing = await this.userRepository.findByEmail(data.email)
    if (existing) throw new ConflictError('User already exists')

    const user = new User(data)
    user.password = await bcrypt.hash(data.password, 10)
    const saved = await this.userRepository.save(user)

    this.emailService.sendWelcome(saved.email).catch(console.error)
    return saved
  }
}

// repositories/userRepository.js (Persistence)
class UserRepository {
  constructor() {
    this.User = require('../models/User')
  }

  async findByEmail(email) {
    return await this.User.findOne({ email }).lean()
  }

  async save(user) {
    return await user.save()
  }
}
```

## Essential Design Patterns

### Repository Pattern
Abstract data access behind an interface. Enables mocking in tests and swapping databases.

```javascript
// Abstraction
class IOrderRepository {
  async findById(id) {}
  async save(order) {}
  async findByUser(userId) {}
}

// MongoDB implementation
class MongoOrderRepository extends IOrderRepository {
  async findById(id) {
    return await Order.findById(id).lean()
  }
  async save(order) {
    const doc = new Order(order)
    return await doc.save()
  }
}
```

### Service Layer Pattern
Encapsulate business logic in services. Routes should be thin; services contain all business rules.

### Factory Pattern
Create objects with complex initialization based on configuration.

```javascript
class PaymentProcessorFactory {
  static create(type, config) {
    switch (type) {
      case 'stripe': return new StripeProcessor(config.stripeKey)
      case 'paypal': return new PayPalProcessor(config.paypalClientId)
      default: throw new Error(`Unknown payment type: ${type}`)
    }
  }
}
const processor = PaymentProcessorFactory.create('stripe', config)
```

### Strategy Pattern
Encapsulate algorithms that can vary independently.

```javascript
class PricingStrategy {
  calculate(basePrice) { throw new Error('Override') }
}
class FlatRateStrategy extends PricingStrategy {
  calculate(basePrice) { return basePrice }
}
class SeasonalStrategy extends PricingStrategy {
  calculate(basePrice) {
    return basePrice * (this.isPeakSeason() ? 1.5 : 0.8)
  }
}
class PackagePricingService {
  constructor(strategy) { this.strategy = strategy }
  getPrice(pkg) { return this.strategy.calculate(pkg.basePrice) }
}
```

### Observer/Pub-Sub Pattern
Decouple event producers from consumers.

```javascript
class EventBus {
  constructor() { this.listeners = {} }
  subscribe(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(callback)
  }
  async publish(event, data) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        await cb(data) // Async safe
      }
    }
  }
}
// Usage:
eventBus.subscribe('order.created', async (order) => {
  await emailService.sendConfirmation(order.customerEmail, order)
})
```

### Decorator Pattern
Add responsibilities to objects dynamically.

```javascript
function withLogging(service) {
  return {
    async create(data) {
      console.log(`[${service.name}] Creating...`, data)
      const result = await service.create(data)
      console.log(`[${service.name}] Created:`, result.id)
      return result
    },
    // Proxy all other methods
    ...Object.fromEntries(
      Object.keys(service)
        .filter(k => typeof service[k] === 'function')
        .map(k => [k, (...args) => service[k](...args)])
    )
  }
}
```

### Singleton Pattern (Use Sparingly)
Only for truly shared resources like database connection pools.

```javascript
class Database {
  static #instance = null
  static getInstance() {
    if (!Database.#instance) Database.#instance = new Database()
    return Database.#instance
  }
  constructor() {
    if (Database.#instance) throw new Error('Use getInstance()')
    this.connect()
  }
}
```

## OOP Best Practices

### Favor Composition Over Inheritance
Build complex objects by combining simpler ones.

```javascript
class OrderService {
  constructor(orderRepository, paymentService, notificationService) {
    this.orderRepository = orderRepository
    this.paymentService = paymentService
    this.notificationService = notificationService
  }
  // Delegates to composed services
}
```

### Immutability Where Possible
Prefer immutable data to prevent side effects.

```javascript
// Bad: mutates
function updateUser(user, updates) {
  user.name = updates.name
  return user
}

// Good: returns new object
function updateUser(user, updates) {
  return { ...user, ...updates }
}
```

### Use Pure Functions
Functions that given same input always return same output, no side effects.

```javascript
// Pure
function calculateTotal(items, taxRate) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  return subtotal * (1 + taxRate)
}
```

### Tell, Don't Ask
Ask objects for data → procedural. Tell objects to do things → OOP.

```javascript
// Tell, Don't Ask (better)
const shouldSend = await user.shouldReceivePremiumEmail()
if (shouldSend) await user.sendPremiumEmail()
```

### Law of Demeter (Principle of Least Knowledge)
Avoid chains longer than one dot.

```javascript
// Bad: user → order → package → name
const packageName = user.order.package.name

// Good: Tell user to get package name
const packageName = await user.getPackageName()
```

### Constructors Should Be Light
Do not perform I/O in constructors. Use async init methods if needed.

```javascript
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository // Just assign
  }
  async initialize() {
    // Expensive async operations if needed
  }
}
```

## Domain-Driven Design (DDD) Lite

For complex business logic, consider these DDD building blocks:

- **Entity**: Objects with identity (User, Package, Order). Equality by ID.
- **Value Object**: Immutable, no identity (Money, Address). Equality by value.
- **Aggregate**: Cluster of entities treated as a unit (Order + OrderItems). Root controls access.
- **Repository**: Collection-like interface for aggregates.
- **Domain Service**: Business logic that doesn't belong to an entity.
- **Domain Event**: Something notable that happened (OrderCreated, PaymentFailed).

**Example:**

```javascript
// Value Object
class Money {
  constructor(amount, currency) {
    this.amount = amount
    this.currency = currency
  }
  add(other) {
    if (this.currency !== other.currency) throw new Error('Currency mismatch')
    return new Money(this.amount + other.amount, this.currency)
  }
}

// Entity with behavior
class Order {
  constructor(id, items, status = 'pending') {
    this.id = id
    this.items = items
    this.status = status
    this.createdAt = new Date()
  }

  confirm() {
    if (this.items.length === 0) throw new Error('Cannot confirm empty order')
    this.status = 'confirmed'
    this.updatedAt = new Date()
    return new DomainEvent('OrderConfirmed', { orderId: this.id })
  }
}
```

## Refactoring Guidelines

**When adding features:**
1. Is there existing similar code? Can you extract an abstraction?
2. Would this be easier if the code was more modular? Refactor first.
3. Does this require new tests? Write them.

**Signs it's time to refactor:**
- Duplicate code in multiple services
- Functions longer than 30 lines
- More than 3 levels of nesting
- Route handler doing validation + business logic + formatting
- Hard-coded values scattered
- Changing one thing requires changing 5 places

**Refactoring process:**
1. Ensure tests cover current behavior (green)
2. Make small, atomic refactor (rename, extract function, extract class)
3. Run tests after each step (should always pass)
4. Commit refactor separately from feature

## Design Review Checklist

Before completing a task, review:

- [ ] **Layers**: Code placed in correct layer (route/service/repo/model)?
- [ ] **SRP**: Does each class/function have a single responsibility?
- [ ] **DI**: Are dependencies injected (not required/imported directly)?
- [ ] **Abstractions**: Have I defined interfaces for things that might change?
- [ ] **Testability**: Can I unit test this without DB/network?
- [ ] **Reusability**: Could this logic be reused? Is it in a service?
- [ ] **Coupling**: Is this loosely coupled? Can components be swapped?
- [ ] **Cohesion**: Do all parts of this module belong together?
- [ ] **Error handling**: Are errors propagated appropriately with domain types?
- [ ] **Patterns**: Have I applied appropriate patterns (Repository, Factory, etc.)?
- [ ] **Extensibility**: What might change? Is it easy to extend without modifying?

## Common Anti-Patterns

❌ **God Route/Service** - One component doing everything → Extract services
❌ **Anemic Domain Model** - Entities with only getters/setters → Move behavior to entities
❌ **Service Locator** - `ServiceLocator.get('UserService')` → Use DI
❌ **Spaghetti Code** - No clear structure → Implement layers
❌ **Copy-Paste Duplication** - Similar code in multiple places → Extract functions
❌ **Magic Values** - Hard-coded strings/numbers → Use constants/config
❌ **Leaky Abstractions** - Repository exposing Mongoise specifics → Return plain objects
❌ **Mutating Arguments** - Changing input params → Return new values
❌ **Long Parameter Lists** - More than 3-4 params → Wrap in DTO/object
❌ **Routes Accessing DB Directly** - Bypassing service layer → Always go through services

## Portfolio Considerations

This project showcases architectural skills. When implementing:

- **Apply patterns where they add value** - Repository, Factory, Strategy, Observer
- **Show layered architecture** - Routes → Services → Repositories clearly separated
- **Use dependency injection** - Constructor injection throughout, not global instances
- **Write clean code** - Descriptive names, small functions (<30 lines), single responsibility
- **Document architecture decisions** - Include in READMEs and commit messages
- **Refactor commits** - "refactor: extract UserService from route handlers" shows design thinking
- **Consider TypeScript** - Adds type safety and interfaces; great for portfolio

## TypeScript Recommendation

For an impressive portfolio, consider adding TypeScript to one or more services. It enforces interfaces, catches errors at compile time, and demonstrates modern backend practices.

Key benefits:
- Define `IUserRepository`, `IUserService` interfaces
- Compile-time type checking
- Better IDE autocomplete
- Self-documenting code
- Generic types for repositories

If adding TypeScript, define clear contracts:

```typescript
// types.ts
interface IUser {
  id: string
  email: string
  username: string
  role: UserRole
}

interface IUserRepository {
  findById(id: string): Promise<IUser | null>
  save(user: IUser): Promise<IUser>
  findByEmail(email: string): Promise<IUser | null>
}

class UserService {
  constructor(private userRepository: IUserRepository) {}  // DI with type safety
  async createUser(data: CreateUserDto): Promise<IUser> {
    const user = await this.userRepository.save({
      ...data,
      id: generateId(),
      createdAt: new Date()
    })
    return user
  }
}
```

## Practical Application

When implementing a new feature:

1. **Design phase**: Identify which layer(s) will be touched. Sketch class diagram mentally.
2. **Define interfaces**: What abstractions do you need? (Repository interface, Service interface)
3. **Implement repository**: Data access layer, return plain objects (lean queries).
4. **Implement service**: Business logic, dependency injection, pure functions where possible.
5. **Implement route**: Validation, HTTP concerns, delegate to service.
6. **Write tests**: Unit test service (mock repository), integration test route (with test DB).
7. **Refactor**: If code feels messy, pause and apply patterns. Extract, compose, decouple.
8. **Review**: Run through checklist above.

## References

- `@.claude/rules/backend-practices` - Express patterns, middleware, service structure
- `@.claude/rules/database` - Repository implementation with MongoDB
- `@.claude/rules/unit-testing` - Testing repositories and services with mocks
- `@.claude/rules/error-handling` - Error types and propagation through layers
- `@.claude/rules/documentation` - Document your architecture decisions

---

**Remember**: This is a portfolio project. The code you write should demonstrate senior-level architectural thinking: clean separation of concerns, testable design, appropriate use of patterns, and maintainable structure. Think before you code.
