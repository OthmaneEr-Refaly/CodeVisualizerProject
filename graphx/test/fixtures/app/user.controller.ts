import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { UserService } from "./user.service";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";

@Controller("users")
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  create(@Body() body: { name: string }) {
    return this.userService.create(body);
  }
}
