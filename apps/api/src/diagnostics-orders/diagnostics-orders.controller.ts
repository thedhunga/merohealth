import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

const orderSchema = z.object({
  clinicianId: z.string().trim().min(1).max(200),
  kind: z.enum(['LAB', 'IMAGING']),
  testName: z.string().trim().min(1).max(300),
});

const resultSchema = z.object({
  resultSource: z.enum(['HL7', 'MANUAL']),
  value: z.string().trim().min(1).max(1000),
  recordedBy: z.string().trim().min(1).max(200),
});

const releaseSchema = z.object({
  releasedBy: z.string().trim().min(1).max(200),
});

const cancelSchema = z.object({
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
 * Row 7 of clinical-suite.md's capability map: lab and imaging orders +
 * results. `listOrders`/`getOrder` are the patient-facing reads — gated
 * behind `SessionAuthGuard`, the subject always the caller's own session id,
 * same shape `clinical-summary.controller.ts` established. `order`/
 * `recordResult`/`release`/`cancel` stay ungated on purpose: they are
 * clinician-workflow writes (`clinicianId`/`recordedBy`/`releasedBy` are
 * free text) and this app has no clinician-side session to check them
 * against yet — the same documented exception `clinical-charting.
 * controller.ts` and `clinical-summary.controller.ts`'s
 * `recordClinicianAuthored` carry.
 */
@ApiTags('diagnostics-orders')
@Controller('diagnostics-orders')
export class DiagnosticsOrdersController {
  constructor(private readonly diagnosticsOrders: DiagnosticsOrdersService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.diagnosticsOrders.health();
  }

  @Post('encounters/:encounterId/orders')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({
    summary: 'Place a lab or imaging order against an encounter. Refused (503) while clinical-charting is unavailable.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clinicianId', 'kind', 'testName'],
      properties: {
        clinicianId: { type: 'string' },
        kind: { type: 'string', enum: ['LAB', 'IMAGING'] },
        testName: { type: 'string' },
      },
    },
  })
  order(@Param('encounterId') encounterId: string, @Body() body: unknown) {
    return this.diagnosticsOrders.orderDiagnostic(encounterId, parseOrThrow(orderSchema, body));
  }

  @Get('orders')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own diagnostic orders" })
  listOrders(@CurrentUser() user: CurrentUserResult) {
    const orders = this.diagnosticsOrders.listOrders(user.subjectId);
    return { orders, total: orders.length };
  }

  @Get('orders/:orderId')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'orderId' })
  @ApiOperation({ summary: "Read one of the signed-in caller's own diagnostic orders by opaque id" })
  getOrder(@CurrentUser() user: CurrentUserResult, @Param('orderId') orderId: string) {
    return this.diagnosticsOrders.getOwnOrder(orderId, user.subjectId);
  }

  @Post('orders/:orderId/result')
  @ApiParam({ name: 'orderId' })
  @ApiOperation({
    summary:
      'Record a result against an ORDERED order. Always starts HELD and non-diagnostic — the compliance ' +
      "register's interim control, pending laboratory governance.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['resultSource', 'value', 'recordedBy'],
      properties: {
        resultSource: { type: 'string', enum: ['HL7', 'MANUAL'] },
        value: { type: 'string' },
        recordedBy: { type: 'string' },
      },
    },
  })
  recordResult(@Param('orderId') orderId: string, @Body() body: unknown) {
    return this.diagnosticsOrders.recordResult(orderId, parseOrThrow(resultSchema, body));
  }

  @Post('orders/:orderId/release')
  @ApiParam({ name: 'orderId' })
  @ApiOperation({ summary: 'Release a HELD result. Rejected if the order has no held result.' })
  @ApiBody({ schema: { type: 'object', required: ['releasedBy'], properties: { releasedBy: { type: 'string' } } } })
  release(@Param('orderId') orderId: string, @Body() body: unknown) {
    return this.diagnosticsOrders.releaseResult(orderId, parseOrThrow(releaseSchema, body).releasedBy);
  }

  @Post('orders/:orderId/cancel')
  @ApiParam({ name: 'orderId' })
  @ApiOperation({ summary: 'Cancel an ORDERED order. Rejected on a RESULTED or already-cancelled order.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  cancel(@Param('orderId') orderId: string, @Body() body: unknown) {
    return this.diagnosticsOrders.cancelOrder(orderId, parseOrThrow(cancelSchema, body).reason);
  }
}
