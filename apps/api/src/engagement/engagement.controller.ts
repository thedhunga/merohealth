import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { EngagementService } from './engagement.service.js';

const queueMessageSchema = z.object({
  channel: z.enum(['SMS', 'WHATSAPP']),
  kind: z.enum(['REMINDER', 'GENERAL']),
  body: z.string().trim().min(1),
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

/** Row 15 of clinical-suite.md's capability map: patient messaging and reminders over SMS/WhatsApp. */
@ApiTags('engagement')
@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.engagement.health();
  }

  @Post('patients/:patientId/messages')
  @ApiParam({ name: 'patientId' })
  @ApiOperation({
    summary:
      'Queue a message to a patient and attempt delivery immediately. Refused (503) while patient-registry ' +
      'is unavailable — always succeeds otherwise, recording SENT or FAILED rather than throwing on a ' +
      'delivery failure.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['channel', 'kind', 'body'],
      properties: {
        channel: { type: 'string', enum: ['SMS', 'WHATSAPP'] },
        kind: { type: 'string', enum: ['REMINDER', 'GENERAL'] },
        body: { type: 'string' },
      },
    },
  })
  queueMessage(@Param('patientId') patientId: string, @Body() body: unknown) {
    return this.engagement.queueMessage(patientId, parseOrThrow(queueMessageSchema, body));
  }

  @Get('messages')
  @ApiOperation({ summary: 'List queued/sent/failed messages, optionally filtered by patientId' })
  @ApiQuery({ name: 'patientId', required: false })
  listMessages(@Query('patientId') patientId?: string) {
    const messages = this.engagement.listMessages(patientId);
    return { messages, total: messages.length };
  }

  @Get('messages/:messageId')
  @ApiParam({ name: 'messageId' })
  @ApiOperation({ summary: 'Read one message by opaque id' })
  getMessage(@Param('messageId') messageId: string) {
    return this.engagement.getMessage(messageId);
  }

  @Post('messages/:messageId/retry')
  @ApiParam({ name: 'messageId' })
  @ApiOperation({
    summary:
      'Retry a FAILED message. Requeues it and attempts delivery again to the phone number captured at ' +
      'queue time — stays available even if patient-registry is down.',
  })
  retryMessage(@Param('messageId') messageId: string) {
    return this.engagement.retryMessage(messageId);
  }
}
