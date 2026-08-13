import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string }) {
    return this.userService.create(body);
  }
}
