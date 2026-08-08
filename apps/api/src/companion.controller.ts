import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assessSafety, getSafetyTemplate } from '@swasthya/clinical-safety';
import { z } from 'zod';
import { PerplexityHealthService } from './perplexity-health.service.js';
const requestSchema = z.object({
  message: z.string().trim().min(3).max(4000),
  language: z.enum(['ne', 'en', 'ne-Latn']).default('ne'),
});
@ApiTags('companion')
@Controller('companion')
export class CompanionController {
  constructor(private readonly healthResearch = new PerplexityHealthService()) {}

  @Post('assess')
  @ApiOperation({ summary: 'Run deterministic pre-generation safety screening' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['message'],
      properties: {
        message: { type: 'string', example: 'मलाई सास फेर्न गाह्रो छ' },
        language: { enum: ['ne', 'en', 'ne-Latn'] },
      },
    },
  })
  assess(@Body() body: unknown) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: parsed.error.flatten(),
      });
    const assessment = assessSafety(parsed.data.message);
    const template = assessment.templateId
      ? getSafetyTemplate(assessment.templateId, parsed.data.language === 'en' ? 'en' : 'ne')
      : null;
    return {
      assessment,
      template,
      generatedAnswer: assessment.interruptConversation
        ? null
        : {
            provider: 'mock',
            status: 'not-generated',
            reason: 'Safety assessment endpoint does not generate medical content.',
          },
    };
  }

  @Post('research')
  @ApiOperation({
    summary: 'Safety-screen a question, then request cited health research from Perplexity Sonar',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['message'],
      properties: {
        message: { type: 'string', example: 'What can cause a headache?' },
        language: { enum: ['ne', 'en', 'ne-Latn'] },
      },
    },
  })
  async research(@Body() body: unknown) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: parsed.error.flatten(),
      });
    const assessment = assessSafety(parsed.data.message);
    const template = assessment.templateId
      ? getSafetyTemplate(assessment.templateId, parsed.data.language === 'en' ? 'en' : 'ne')
      : null;
    if (assessment.interruptConversation) return { assessment, template, research: null };
    return {
      assessment,
      template: null,
      research: await this.healthResearch.research(parsed.data.message, parsed.data.language),
    };
  }
}
