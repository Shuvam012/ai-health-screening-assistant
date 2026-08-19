import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Custom application error with status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'AppError';
  }
}

/**
 * Global error handling middleware.
 * Logs the full error, returns sanitized response to client.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the full error
  logger.error(`${err.name}: ${err.message}`, {
    stack: err.stack,
    ...(err as unknown as Record<string, unknown>),
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message,
    });
    return;
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      message: 'The provided ID is not valid.',
    });
    return;
  }

  // Custom app error with status code
  if ('statusCode' in err) {
    const appErr = err as AppError;
    res.status(appErr.statusCode).json({
      success: false,
      error: appErr.message,
    });
    return;
  }

  // Default: Internal server error
  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message;

  res.status(500).json({
    success: false,
    error: message,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
