import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { UsersService } from './users.service.js';
import { USER_ROLES } from './user.types.js';
import type { CreateUserInput, UpdateUserInput } from './user.types.js';

@Controller('users')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Administrador')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Post()
  create(@Body() body: CreateUserInput) {
    this.validateCreate(body);
    return this.usersService.create(body);
  }

  @Get(':id')
  find(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateUserInput, @Req() request: AuthenticatedRequest) {
    this.validateUpdate(body);
    if (request.user?.sub === id && body.status === 'Inativo') {
      throw new ForbiddenException('Não é permitido inativar a própria conta.');
    }
    if (request.user?.sub === id && body.role !== undefined && body.role !== 'Administrador') {
      throw new ForbiddenException('Não é permitido remover o próprio perfil de administrador.');
    }
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    if (request.user?.sub === id) {
      throw new ForbiddenException('Não é permitido excluir a própria conta.');
    }
    await this.usersService.remove(id);
    return { message: 'Conta excluída com sucesso.' };
  }

  private validateCreate(body: CreateUserInput): void {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Informe os dados da conta.');
    }
    if (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.trim().length > 200) {
      throw new BadRequestException('Informe o nome completo.');
    }
    if (typeof body.email !== 'string' || body.email.trim().length > 254 || !/^\S+@\S+\.\S+$/.test(body.email.trim())) {
      throw new BadRequestException('Informe um e-mail válido.');
    }
    if (typeof body.phone !== 'string' || body.phone.trim().length < 8 || body.phone.trim().length > 30) {
      throw new BadRequestException('Informe um telefone válido.');
    }
    if (typeof body.password !== 'string' || body.password.length < 8) {
      throw new BadRequestException('A senha deve ter ao menos 8 caracteres.');
    }
    if (!USER_ROLES.includes(body.role)) {
      throw new BadRequestException('Selecione um perfil de acesso válido.');
    }
  }

  private validateUpdate(body: UpdateUserInput): void {
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      throw new BadRequestException('Informe ao menos um campo para alterar.');
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.trim().length > 200)) {
      throw new BadRequestException('Informe o nome completo.');
    }
    if (body.email !== undefined && (typeof body.email !== 'string' || body.email.trim().length > 254 || !/^\S+@\S+\.\S+$/.test(body.email.trim()))) {
      throw new BadRequestException('Informe um e-mail válido.');
    }
    if (body.phone !== undefined && (typeof body.phone !== 'string' || body.phone.trim().length < 8 || body.phone.trim().length > 30)) {
      throw new BadRequestException('Informe um telefone válido.');
    }
    if (body.password !== undefined && (typeof body.password !== 'string' || body.password.length < 8)) {
      throw new BadRequestException('A senha deve ter ao menos 8 caracteres.');
    }
    if (body.role !== undefined && !USER_ROLES.includes(body.role)) {
      throw new BadRequestException('Selecione um perfil de acesso válido.');
    }
    if (body.status !== undefined && body.status !== 'Ativo' && body.status !== 'Inativo') {
      throw new BadRequestException('Informe uma situação de conta válida.');
    }
  }
}
