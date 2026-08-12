import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';

/**
 * Row 14 of clinical-suite.md's capability map: analytics and dashboards.
 * GET-only — this module never writes, the same population-health (row 13)
 * precedent, so there is no POST route to validate a body for.
 */
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.analytics.health();
  }

  @Get('patients')
  @ApiOperation({
    summary:
      'Patient registry totals, broken down by recorded sex. Refused (503) while patient-registry is unavailable.',
  })
  patients() {
    return this.analytics.patientRegistrySummary();
  }

  @Get('scheduling')
  @ApiOperation({
    summary: 'Appointment totals, broken down by status. Refused (503) while scheduling is unavailable.',
  })
  scheduling() {
    return this.analytics.schedulingSummary();
  }

  @Get('billing')
  @ApiOperation({
    summary: 'Invoice totals, broken down by status. Refused (503) while billing is unavailable.',
  })
  billing() {
    return this.analytics.billingSummary();
  }

  @Get('referrals')
  @ApiOperation({
    summary: 'Referral totals, broken down by status. Refused (503) while referrals is unavailable.',
  })
  referrals() {
    return this.analytics.referralsSummary();
  }

  @Get('engagement')
  @ApiOperation({
    summary: 'Engagement message totals, broken down by status. Refused (503) while engagement is unavailable.',
  })
  engagement() {
    return this.analytics.engagementSummary();
  }

  @Get('immunization')
  @ApiOperation({
    summary: 'Immunization record totals, broken down by status. Refused (503) while immunization is unavailable.',
  })
  immunization() {
    return this.analytics.immunizationSummary();
  }
}
