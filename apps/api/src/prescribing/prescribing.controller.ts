import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { PrescribingService } from './prescribing.service.js';

const openPrescriptionSchema = z.object({
  clinicianId: z.string().trim().min(1).max(200),
});

const addLineSchema = z.object({
  label: z.string().trim().min(1).max(500),
  dosageInstructions: z.string().trim().min(1).max(1000),
  quantity: z.string().trim().min(1).max(200),
  isControlledSubstance: z.boolean(),
});

const signSchema = z.object({
  attestation: z.string().trim().min(1).max(2000),
});

const voidSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

/**
 * Row 6 of clinical-suite.md's capability map: ePrescribing, Nepali formulary.
 * `listPrescriptions`/`getPrescription` are the patient-facing reads — gated
 * behind `SessionAuthGuard`, the subject always the caller's own session id,
 * same shape `referrals.controller.ts`/`immunization.controller.ts`
 * established. `openPrescription`/`addLine`/`sign`/`void` stay ungated on
 * purpose: `openPrescription` resolves `patientId` from the encounter via
 * clinical-charting, never a client-supplied field, and the other three take
 * only an opaque `prescriptionId` plus clinician-authored content — no patient
 * identity in the body at all, and this app has no clinician-side session to
 * check them against yet, the same documented exception every sibling
 * clinical-suite controller carries.
 */
@ApiTags('prescribing')
@Controller('prescribing')
export class PrescribingController {
  constructor(private readonly prescribing: PrescribingService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.prescribing.health();
  }

  @Post('encounters/:encounterId/prescriptions')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({
    summary: 'Open a DRAFT prescription against an encounter. Refused (503) while clinical-charting is unavailable.',
  })
  @ApiBody({
    schema: { type: 'object', required: ['clinicianId'], properties: { clinicianId: { type: 'string' } } },
  })
  openPrescription(@Param('encounterId') encounterId: string, @Body() body: unknown) {
    return this.prescribing.openPrescription(encounterId, parseOrThrow(openPrescriptionSchema, body));
  }

  @Get('prescriptions')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own prescriptions" })
  listPrescriptions(@CurrentUser() user: CurrentUserResult) {
    const prescriptions = this.prescribing.listPrescriptions(user.subjectId);
    return { prescriptions, total: prescriptions.length };
  }

  @Get('prescriptions/:prescriptionId')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'prescriptionId' })
  @ApiOperation({ summary: "Read one of the signed-in caller's own prescriptions by opaque id" })
  getPrescription(@CurrentUser() user: CurrentUserResult, @Param('prescriptionId') prescriptionId: string) {
    return this.prescribing.getOwnPrescription(prescriptionId, user.subjectId);
  }

  @Post('prescriptions/:prescriptionId/lines')
  @ApiParam({ name: 'prescriptionId' })
  @ApiOperation({
    summary:
      'Add a line to a DRAFT prescription. isControlledSubstance:true is always refused — the compliance ' +
      "register's interim control, pending counsel/pharmacy approval.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['label', 'dosageInstructions', 'quantity', 'isControlledSubstance'],
      properties: {
        label: { type: 'string' },
        dosageInstructions: { type: 'string' },
        quantity: { type: 'string' },
        isControlledSubstance: { type: 'boolean' },
      },
    },
  })
  addLine(@Param('prescriptionId') prescriptionId: string, @Body() body: unknown) {
    return this.prescribing.addLine(prescriptionId, parseOrThrow(addLineSchema, body));
  }

  @Post('prescriptions/:prescriptionId/sign')
  @ApiParam({ name: 'prescriptionId' })
  @ApiOperation({
    summary:
      'Sign a prescription, locking it against further edits. Runs a medication-safety check first; records ' +
      'UNAVAILABLE rather than blocking if that check could not run.',
  })
  @ApiBody({ schema: { type: 'object', required: ['attestation'], properties: { attestation: { type: 'string' } } } })
  sign(@Param('prescriptionId') prescriptionId: string, @Body() body: unknown) {
    return this.prescribing.signPrescription(prescriptionId, parseOrThrow(signSchema, body).attestation);
  }

  @Post('prescriptions/:prescriptionId/void')
  @ApiParam({ name: 'prescriptionId' })
  @ApiOperation({ summary: 'Void a signed prescription. Rejected on a draft or an already-voided prescription.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  void(@Param('prescriptionId') prescriptionId: string, @Body() body: unknown) {
    return this.prescribing.voidPrescription(prescriptionId, parseOrThrow(voidSchema, body).reason);
  }
}
