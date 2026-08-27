export class LoggingInterceptor {
  intercept(context: unknown, next: { handle: () => unknown }) {
    return next.handle();
  }
}
