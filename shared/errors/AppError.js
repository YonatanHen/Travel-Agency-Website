class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Subclasses for common HTTP errors
const BadRequestError = (message) => new AppError(message, 400);
const UnauthorizedError = (message) => new AppError(message, 401);
const ForbiddenError = (message) => new AppError(message, 403);
const NotFoundError = (message) => new AppError(message, 404);
const ConflictError = (message) => new AppError(message, 409);
const ValidationError = (message) => new AppError(message, 422);

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError
};