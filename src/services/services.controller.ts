import { Body, Controller, Get, Param, Post, Put, Delete, Query, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Role } from '../auth/roles.enum';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('services')
export class ServicesController {
    constructor(private readonly servicesService: ServicesService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    @Roles(Role.ADMIN)
    create(@Body() dto: CreateServiceDto) {
        return this.servicesService.create(dto);
    }

    // READ – list
    @Get()
    findAll(@Query('includeInactive') includeInactive?: string) {
        return this.servicesService.findAll(includeInactive === 'true');
    }

    // READ – detail
    @Get(':id')
    findById(@Param('id') id: string) {
        return this.servicesService.findById(id);
    }

    // UPDATE
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Put(':id')
    @Roles(Role.ADMIN)
    update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
        return this.servicesService.update(id, dto);
    }

    // DELETE (soft)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':id')
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.servicesService.remove(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Put(':id/active/:isActive')
    @Roles(Role.ADMIN)
    setActive(
        @Param('id') id: string,
        @Param('isActive') isActive: string,
    ) {
        return this.servicesService.setActive(id, isActive === 'true');
    }
}
