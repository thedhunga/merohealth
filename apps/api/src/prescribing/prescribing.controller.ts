import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrescribingService } from './prescribing.service.js';

const openPrescriptionSchema = z.object({
  clinicianId: z.string().trim().min(1),
});

const addLineSchema = z.object({
  label: z.string().trim().min(1),
  dosageInstructions: z.string().trim().min(1),
  quantity: z.string().trim().min(1),
  isControlledSubstance: z.boolean(),
});

const signSchema = z.object({
  attestation: z.string().trim().min(1),
});

const voidSchema = z.object({
  reason: z.string().trim().min(1),
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

/** Row 6 of clinical-suite.md's capability map: ePrescribing, Nepali formulary. */
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
  @ApiOperation({ summary: 'List prescriptions, optionally filtered by patientId' })
  @ApiQuery({ name: 'patientId', required: false })
  listPrescriptions(@Query('patientId') patientId?: string) {
    const prescriptions = this.prescribing.listPrescriptions(patientId);
    return { prescriptions, total: prescriptions.length };
  }

  @Get('prescriptions/:prescriptionId')
  @ApiParam({ name: 'prescriptionId' })
  @ApiOperation({ summary: 'Read one prescription by opaque id' })
  getPrescription(@Param('prescriptionId') prescriptionId: string) {
    return this.prescribing.getPrescription(prescriptionId);
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
