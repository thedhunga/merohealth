import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicalSuiteService } from './clinical-suite.service.js';

@ApiTags('clinical-suite')
@Controller('clinical-suite')
export class ClinicalSuiteController {
  constructor(private readonly suite: ClinicalSuiteService) {}

  @Get('modules')
  @ApiOperation({
    summary:
      "Availability of every clinical-suite module, per clinical-suite.md §2's ModuleDescriptor contract — the data source a future clinician shell renders around holes with.",
  })
  modules() {
    return this.suite.resolve();
  }
}
