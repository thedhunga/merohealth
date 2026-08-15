import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Readiness-independent service health' })
  health() { return { status: 'ok', service: 'api', integrations: { ai: 'mock', video: 'mock', payment: 'mock', sms: 'mock', engagement: 'mock', maps: 'mock' } }; }
}
