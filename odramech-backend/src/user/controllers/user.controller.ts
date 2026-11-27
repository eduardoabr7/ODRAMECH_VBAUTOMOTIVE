import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { AuthPayload } from 'src/auth/interfaces/auth-payload.interface';
import { CurrentAuth } from 'src/core/auth/current-auth.decorator';
import { assertStaff } from 'src/shared/utils/role.util';
import { UserService } from '../services/user.service';
import { FrontEndCreateUser } from '../dto/create-user.dto';
import { CreateWorkerDTO } from '../dto/create-worker-dto';
import { UpdateUserDTO } from '../dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Post('create')
  createUser(@Body() data: FrontEndCreateUser, @CurrentAuth() auth: AuthPayload) {
    return this.users.createClient(auth, data);
  }

  @Post('create-worker')
  createWorker(@Body() data: CreateWorkerDTO, @CurrentAuth() auth: AuthPayload) {
    return this.users.createStaff(auth, data);
  }

  @Get('search')
  search(@Query('term') term: string, @CurrentAuth() auth: AuthPayload) {
    assertStaff(auth.role);
    return this.users.search(auth, term ?? '');
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number, @CurrentAuth() auth: AuthPayload) {
    if (auth.sub !== id) assertStaff(auth.role);
    return this.users.getById(id, auth.establishmentId);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateUserDTO, @CurrentAuth() auth: AuthPayload) {
    if (auth.sub !== id) assertStaff(auth.role);
    return this.users.update(auth, id, data);
  }
}
