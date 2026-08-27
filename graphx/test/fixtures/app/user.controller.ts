import { Controller, Get, Post, Param, Body, UseGuards, UseInterceptors, UsePipes } from "@nestjs/common";
import { UserService } from "./user.service";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";
import { LoggingInterceptor } from "./logging.interceptor";
import { ValidationPipe } from "./validation.pipe";

@Controller("users")
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @UsePipes(ValidationPipe)
  create(@Body() body: { name: string }) {
    return this.userService.create(body);
  }
}
