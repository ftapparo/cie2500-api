import { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({
    data,
    message: null,
    errors: null,
  });
}

export function fail(res: Response, message: string, status = 500, errors: unknown = null) {
  return res.status(status).json({
    data: null,
    message,
    errors,
  });
}

