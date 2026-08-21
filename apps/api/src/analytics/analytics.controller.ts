import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OwnerGuard } from '../auth/owner.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { AnalyticsService } from './analytics.service.js';

/**
 * Row 14 of clinical-suite.md's capability map: analytics and dashboards.
 * GET-only — this module never writes, the same population-health (row 13)
 * precedent, so there is no POST route to validate a body for.
 *
 * Every summary here is a clinic-wide aggregate count with no single
 * `patientId` in its request shape — the same cross-patient shape task AA's
 * log entry found made `population-health` unfixable with a patient
 * `SessionAuthGuard`. But unlike `population-health`, nothing here is a
 * per-patient registry a clinician would act on; it is business-dashboard
 * totals (invoice counts by status, appointment counts by status, and so
 * on), the exact shape `EarlyAccessController.export` already gates with
 * `OwnerGuard` — so it takes that same precedent rather than waiting on the
 * `tenancy` module's clinician role.
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
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({
    summary:
      'Patient registry totals, broken down by recorded sex. Refused (503) while patient-registry is unavailable.',
  })
  patients() {
    return this.analytics.patientRegistrySummary();
  }

  @Get('scheduling')
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({
    summary: 'Appointment totals, broken down by status. Refused (503) while scheduling is unavailable.',
  })
  scheduling() {
    return this.analytics.schedulingSummary();
  }

  @Get('billing')
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({
    summary: 'Invoice totals, broken down by status. Refused (503) while billing is unavailable.',
  })
  billing() {
    return this.analytics.billingSummary();
  }

  @Get('referrals')
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({
    summary: 'Referral totals, broken down by status. Refused (503) while referrals is unavailable.',
  })
  referrals() {
    return this.analytics.referralsSummary();
  }

  @Get('engagement')
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({
    summary: 'Engagement message totals, broken down by status. Refused (503) while engagement is unavailable.',
  })
  engagement() {
    return this.analytics.engagementSummary();
  }

  @Get('immunization')
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({
    summary: 'Immunization record totals, broken down by status. Refused (503) while immunization is unavailable.',
  })
  immunization() {
    return this.analytics.immunizationSummary();
  }

  @Get('diagnostics-orders')
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({
    summary:
      'Diagnostic order totals, broken down by status. Refused (503) while diagnostics-orders is unavailable.',
  })
  diagnosticsOrders() {
    return this.analytics.diagnosticsOrdersSummary();
  }
}
