import { Response } from 'express';

// Enable BigInt serialization to JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json(data);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown
): void {
  res.status(statusCode).json({
    status: 'error',
    error: {
      message,
      statusCode,
      details: details ?? null
    }
  });
}
