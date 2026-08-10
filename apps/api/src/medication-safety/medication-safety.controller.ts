import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { MedicationSafetyService } from './medication-safety.service.js';

const checkSchema = z.object({
  patientId: z.string().trim().min(1),
  proposedLabel: z.string().trim().min(1),
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

/** Row 5 of clinical-suite.md's capability map: drug interaction / allergy checking. */
@ApiTags('medication-safety')
@Controller('medication-safety')
export class MedicationSafetyController {
  constructor(private readonly medicationSafety: MedicationSafetyService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.medicationSafety.health();
  }

  @Post('check')
  @ApiOperation({
    summary:
      "Check a proposed medication against a patient's active allergies, active medications, and the interaction ruleset. Returns checked:false, not an error, while clinical-summary is unavailable.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['patientId', 'proposedLabel'],
      properties: {
        patientId: { type: 'string' },
        proposedLabel: { type: 'string' },
      },
    },
  })
  check(@Body() body: unknown) {
    const { patientId, proposedLabel } = parseOrThrow(checkSchema, body);
    return this.medicationSafety.checkMedication(patientId, proposedLabel);
  }
}
