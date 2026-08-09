import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PatientRegistryService } from './patient-registry.service.js';

const addressSchema = z.object({
  district: z.string().trim().min(1),
  municipality: z.string().trim().min(1),
  ward: z.string().trim().min(1).optional(),
});

const demographicsSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD'),
  sex: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED']),
  phone: z.string().trim().min(1),
  preferredLocale: z.enum(['ne', 'en', 'ne-Latn']),
  address: addressSchema.optional(),
});

const updateDemographicsSchema = demographicsSchema.partial();

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
 * Row 1 of clinical-suite.md's capability map: "Foundation. Owns identity;
 * others reference by id only." There is deliberately no list-all route
 * here beyond what `PatientRegistryService.list()` supports internally —
 * every other clinical-suite module will look a patient up by the opaque id
 * it already holds, never browse the whole registry.
 */
@ApiTags('patient-registry')
@Controller('patients')
export class PatientRegistryController {
  constructor(private readonly patients: PatientRegistryService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.patients.health();
  }

  @Post()
  @ApiOperation({ summary: 'Register a new patient — the identity every other clinical module references by id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['displayName', 'dateOfBirth', 'sex', 'phone', 'preferredLocale'],
      properties: {
        displayName: { type: 'string' },
        dateOfBirth: { type: 'string', example: '1990-04-12' },
        sex: { enum: ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'] },
        phone: { type: 'string' },
        preferredLocale: { enum: ['ne', 'en', 'ne-Latn'] },
        address: {
          type: 'object',
          properties: {
            district: { type: 'string' },
            municipality: { type: 'string' },
            ward: { type: 'string' },
          },
        },
      },
    },
  })
  register(@Body() body: unknown) {
    return this.patients.register(parseOrThrow(demographicsSchema, body));
  }

  @Get(':patientId')
  @ApiParam({ name: 'patientId' })
  @ApiOperation({ summary: 'Read one patient by opaque id' })
  get(@Param('patientId') patientId: string) {
    return this.patients.get(patientId);
  }

  @Post(':patientId/demographics')
  @ApiParam({ name: 'patientId' })
  @ApiOperation({ summary: 'Update demographic fields — a partial patch, unspecified fields are unchanged' })
  updateDemographics(@Param('patientId') patientId: string, @Body() body: unknown) {
    return this.patients.updateDemographics(patientId, parseOrThrow(updateDemographicsSchema, body));
  }
}
