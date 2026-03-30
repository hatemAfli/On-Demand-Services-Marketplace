import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.clientsService.getMe(user.id);
  }

  @Post('me')
  async createMe(@CurrentUser() user: any, @Body() dto: CreateClientDto) {
    return this.clientsService.createMe(user.id, dto);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: any, @Body() dto: UpdateClientDto) {
    return this.clientsService.updateMe(user.id, dto);
  }

  @Delete('me')
  async deleteMe(@CurrentUser() user: any) {
    return this.clientsService.deleteMe(user.id);
  }
}

