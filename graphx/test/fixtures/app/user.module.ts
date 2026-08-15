import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { RequestLoggerMiddleware } from "./request-logger.middleware";

@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("users");
  }
}
