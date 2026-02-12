import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Response {
    ok: <T>(data: T, status?: number) => Response;
    fail: (message: string, status?: number, errors?: unknown) => Response;
  }
}

