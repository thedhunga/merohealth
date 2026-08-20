import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { BillingService } from './billing.service.js';

const openInvoiceSchema = z.object({
  clinicianId: z.string().trim().min(1).max(200),
});

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  amountPaisa: z.number().int().positive(),
  payerType: z.enum(['CASH', 'INSURANCE', 'NHIF']),
});

const paymentSchema = z.object({
  reference: z.string().trim().min(1).max(200),
  recordedBy: z.string().trim().min(1).max(200),
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
 * Row 10 of clinical-suite.md's capability map: billing, claims, revenue
 * cycle.
 *
 * `listInvoices`/`getInvoice` carry `SessionAuthGuard` and are scoped to the
 * caller — a prior version of this file left both fully unauthenticated
 * (`GET /billing/invoices` with no `patientId` returned every patient's
 * invoices, line items and payments system-wide; `GET
 * /billing/invoices/:invoiceId` read any invoice by a guessed or leaked id),
 * the identical gap `TeleconsultationController` was fixed for one run
 * earlier — see that file's doc comment. `openInvoice`/`addLineItem`/
 * `issueInvoice`/`recordPayment`/`voidInvoice` stay unguarded: they are
 * clinic/billing-staff actions (`clinicianId`/`recordedBy` are free-text
 * fields trusted from the request body, the same as across the rest of this
 * clinical suite), and this app has no clinician-side session to check them
 * against yet. Gating them behind a *patient* `SessionAuthGuard` would not
 * make them correct, only unusable.
 */
@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.billing.health();
  }

  @Post('encounters/:encounterId/invoices')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({
    summary: 'Open a DRAFT invoice against an encounter. Refused (503) while clinical-charting is unavailable.',
  })
  @ApiBody({ schema: { type: 'object', required: ['clinicianId'], properties: { clinicianId: { type: 'string' } } } })
  openInvoice(@Param('encounterId') encounterId: string, @Body() body: unknown) {
    return this.billing.openInvoice(encounterId, parseOrThrow(openInvoiceSchema, body));
  }

  @Get('invoices')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own invoices" })
  listInvoices(@CurrentUser() user: CurrentUserResult) {
    const invoices = this.billing.listInvoices(user.subjectId);
    return { invoices, total: invoices.length };
  }

  @Get('invoices/:invoiceId')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'invoiceId' })
  @ApiOperation({ summary: "Read one of the caller's own invoices by opaque id" })
  getInvoice(@CurrentUser() user: CurrentUserResult, @Param('invoiceId') invoiceId: string) {
    return this.billing.getInvoiceForOwner(invoiceId, user.subjectId);
  }

  @Post('invoices/:invoiceId/line-items')
  @ApiParam({ name: 'invoiceId' })
  @ApiOperation({
    summary:
      'Add a line item to a DRAFT invoice. payerType is CASH, INSURANCE or NHIF — the three channels ' +
      "clinical-suite.md's capability map names for Nepal.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['description', 'amountPaisa', 'payerType'],
      properties: {
        description: { type: 'string' },
        amountPaisa: { type: 'integer' },
        payerType: { type: 'string', enum: ['CASH', 'INSURANCE', 'NHIF'] },
      },
    },
  })
  addLineItem(@Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    return this.billing.addLineItem(invoiceId, parseOrThrow(lineItemSchema, body));
  }

  @Post('invoices/:invoiceId/issue')
  @ApiParam({ name: 'invoiceId' })
  @ApiOperation({ summary: 'Issue a DRAFT invoice, locking its line items. Rejected if it has none.' })
  issueInvoice(@Param('invoiceId') invoiceId: string) {
    return this.billing.issueInvoice(invoiceId);
  }

  @Post('invoices/:invoiceId/payments')
  @ApiParam({ name: 'invoiceId' })
  @ApiOperation({
    summary:
      'Record a payment against an ISSUED invoice. Always settles through the MOCK provider — see ' +
      'shared-types for why no real payment provider is declared yet.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reference', 'recordedBy'],
      properties: { reference: { type: 'string' }, recordedBy: { type: 'string' } },
    },
  })
  recordPayment(@Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    return this.billing.recordPayment(invoiceId, parseOrThrow(paymentSchema, body));
  }

  @Post('invoices/:invoiceId/void')
  @ApiParam({ name: 'invoiceId' })
  @ApiOperation({ summary: 'Void a DRAFT or ISSUED invoice. Rejected once it is PAID — there is no refund path yet.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  voidInvoice(@Param('invoiceId') invoiceId: string, @Body() body: unknown) {
    return this.billing.voidInvoice(invoiceId, parseOrThrow(voidSchema, body).reason);
  }
}
