declare module "@nestjs/common" {
  export function Controller(path?: string): ClassDecorator;
  export function Injectable(): ClassDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Put(path?: string): MethodDecorator;
  export function Delete(path?: string): MethodDecorator;
  export function Patch(path?: string): MethodDecorator;
  export function Param(key?: string): ParameterDecorator;
  export function Body(): ParameterDecorator;
  export function UseGuards(...guards: unknown[]): ClassDecorator & MethodDecorator;
  export function Module(metadata: { controllers?: unknown[]; providers?: unknown[] }): ClassDecorator;

  export interface MiddlewareConsumer {
    apply(...middleware: unknown[]): {
      forRoutes(...routes: unknown[]): unknown;
      exclude(...routes: unknown[]): { forRoutes(...routes: unknown[]): unknown };
    };
  }

  export interface NestModule {
    configure(consumer: MiddlewareConsumer): void;
  }
}
