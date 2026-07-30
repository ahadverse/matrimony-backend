import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('districts')
  listDistricts() {
    return this.geoService.listDistricts();
  }

  @Get('districts/:district/upazilas')
  listUpazilas(@Param('district') district: string) {
    return this.geoService.listUpazilas(district);
  }
}
