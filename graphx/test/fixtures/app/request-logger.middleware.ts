export class RequestLoggerMiddleware {
  use(req: unknown, res: unknown, next: () => void) {
    next();
  }
}
