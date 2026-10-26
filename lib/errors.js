/** Application errors mapped to explicit HTTP responses by the API routes. */

export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {string} code
   */
  constructor(message, status, code) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  /** @param {string} message */
  constructor(message) {
    super(message, 400, "invalid_request");
  }
}

export class NotFoundError extends AppError {
  /** @param {string} message */
  constructor(message) {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends AppError {
  /** @param {string} message */
  constructor(message) {
    super(message, 409, "conflict");
  }
}

export class ForbiddenError extends AppError {
  /** @param {string} message */
  constructor(message) {
    super(message, 403, "forbidden");
  }
}

export class ProviderUnavailableError extends AppError {
  /** @param {string} message */
  constructor(message) {
    super(message, 503, "provider_unavailable");
  }
}

/** AI adapter failures predate the AppError hierarchy; the route maps 503 by class. */
export class AiUnavailableError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "AiUnavailableError";
  }
}
