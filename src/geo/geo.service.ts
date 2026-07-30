import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

interface DistrictEntry {
  district: string;
  division: string;
  upazilas: string[];
}

@Injectable()
export class GeoService {
  private readonly entries = JSON.parse(
    readFileSync(join(__dirname, '../common/data/bd-geo.json'), 'utf-8'),
  ) as DistrictEntry[];

  listDistricts(): { name: string; division: string }[] {
    return this.entries.map((e) => ({
      name: e.district,
      division: e.division,
    }));
  }

  listUpazilas(district: string): string[] {
    return this.entries.find((e) => e.district === district)?.upazilas ?? [];
  }

  isValidDistrict(district: string): boolean {
    return this.entries.some((e) => e.district === district);
  }

  isValidUpazila(district: string, upazila: string): boolean {
    return this.listUpazilas(district).includes(upazila);
  }
}
