import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

/**
 * Middleware to check validation results and return 400 on errors.
 */
export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({
        field: 'path' in e ? e.path : 'unknown',
        message: e.msg,
      })),
    });
    return;
  }
  next();
}

/**
 * Validate that callId is a valid MongoDB ObjectId.
 */
export const validateCallId = [
  param('callId')
    .isMongoId()
    .withMessage('Invalid call ID format'),
  handleValidationErrors,
];

/**
 * Validate create call request body.
 */
export const validateCreateCall = [
  body('language')
    .optional()
    .isIn(['en', 'hi'])
    .withMessage('Language must be "en" or "hi"'),
  handleValidationErrors,
];
