import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { searchDirectory } from '@swasthya/care-directory';
import type { DirectoryEntityType } from '@swasthya/shared-types';

const allowedTypes = new Set<DirectoryEntityType>(['HOSPITAL', 'CLINIC', 'PHARMACY', 'LABORATORY', 'DOCTOR', 'SPECIALIST', 'HOME_NURSE', 'HOME_SAMPLE_COLLECTION']);

@ApiTags('directory')
@Controller('directory')
export class DirectoryController {
  @Get()
  @ApiOperation({ summary: 'Search fictional care-directory demonstration records' })
  @ApiQuery({ name: 'text', required: false }) @ApiQuery({ name: 'type', required: false })
  search(@Query('text') text?: string, @Query('type') rawType?: string) {
    const type = rawType && allowedTypes.has(rawType as DirectoryEntityType) ? rawType as DirectoryEntityType : undefined;
    const items = searchDirectory({ ...(text ? { text } : {}), ...(type ? { type } : {}) });
    return { items, total: items.length, dataClassification: 'FICTIONAL_DEMONSTRATION', realTimeAvailability: false };
  }
}
