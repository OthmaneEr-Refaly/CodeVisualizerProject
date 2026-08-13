import { Injectable } from "@nestjs/common";

@Injectable()
export class UserService {
  findOne(id: string) {
    return { id, name: "placeholder" };
  }

  create(data: { name: string }) {
    return { id: "new-id", ...data };
  }
}
