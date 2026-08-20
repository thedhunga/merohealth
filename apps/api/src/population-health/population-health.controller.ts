import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PopulationHealthService } from './population-health.service.js';

const summaryKindSchema = z.enum(['CONDITION', 'ALLERGY', 'MEDICATION']);

// Same regex `SchedulingController`'s own `isoInstant` uses, for the same
// "explicit over zod's built-in .datetime()" reason — matches exactly what
// `new Date().toISOString()` emits, which is what every stored
// `scheduledStart` in this API already is.
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const registryQuerySchema = z.object({
  kind: summaryKindSchema,
  label: z.string().trim().min(1).max(200),
});

const recallQuerySchema = registryQuerySchema.extend({
  asOf: z.string().regex(isoInstant, 'asOf must be an ISO 8601 UTC instant'),
});

function parseOrThrow<T>(schema: z.ZodType<T>, query: unknown): T {
  const parsed = schema.safeParse(query);
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
 * Row 13 of clinical-suite.md's capability map: population health,
 * registries and recall. GET-only — this module never writes, per the
 * capability map's own note, so there is no POST route to validate a body
 * for.
 */
@ApiTags('population-health')
@Controller('population-health')
export class PopulationHealthController {
  constructor(private readonly populationHealth: PopulationHealthService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.populationHealth.health();
  }

  @Get('registry')
  @ApiOperation({
    summary:
      'Every patient with an ACTIVE clinical-summary item of the given kind and label. Refused (503) while clinical-summary is unavailable.',
  })
  @ApiQuery({ name: 'kind', enum: ['CONDITION', 'ALLERGY', 'MEDICATION'] })
  @ApiQuery({ name: 'label' })
  async registry(@Query() query: unknown) {
    const { kind, label } = parseOrThrow(registryQuerySchema, query);
    const registry = await this.populationHealth.buildRegistry(kind, label);
    return { registry, total: registry.length };
  }

  @Get('recall')
  @ApiOperation({
    summary:
      'The registry above, each patient marked dueForRecall when they have no SCHEDULED appointment at or after asOf. Refused (503) while clinical-summary or scheduling is unavailable.',
  })
  @ApiQuery({ name: 'kind', enum: ['CONDITION', 'ALLERGY', 'MEDICATION'] })
  @ApiQuery({ name: 'label' })
  @ApiQuery({ name: 'asOf', description: 'ISO 8601 UTC instant' })
  async recall(@Query() query: unknown) {
    const { kind, label, asOf } = parseOrThrow(recallQuerySchema, query);
    const recall = await this.populationHealth.buildRecall(kind, label, asOf);
    return { recall, total: recall.length };
  }
}
