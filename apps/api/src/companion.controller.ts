import { BadRequestException, Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assessSafety, getSafetyTemplate } from '@swasthya/clinical-safety';
import { z } from 'zod';
import { requestIp, type IpRequest } from './common/request-ip.js';
import { CompanionAssessRateLimiter } from './companion-assess-rate-limiter.js';
import { CompanionResearchRateLimiter } from './companion-research-rate-limiter.js';
import { PerplexityHealthService } from './perplexity-health.service.js';
const requestSchema = z.object({
  message: z.string().trim().min(3).max(4000),
  language: z.enum(['ne', 'en', 'ne-Latn']).default('ne'),
});
@ApiTags('companion')
@Controller('companion')
export class CompanionController {
  // Explicit type annotations are required here, not just the default values:
  // Nest's DI reflects `design:paramtypes` from the annotation to resolve the
  // provider at runtime. Without it, tsc still emits metadata but as a bare
  // `Object` token, which Nest cannot match to any registered provider and
  // throws on boot — the default value alone only helps direct construction
  // in a test, never Nest's own instantiation path.
  constructor(
    private readonly healthResearch: PerplexityHealthService = new PerplexityHealthService(),
    private readonly rateLimiter: CompanionResearchRateLimiter = new CompanionResearchRateLimiter(),
    private readonly assessRateLimiter: CompanionAssessRateLimiter = new CompanionAssessRateLimiter(),
  ) {}

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
  assess(@Body() body: unknown, @Req() request: IpRequest) {
    if (!this.assessRateLimiter.allow(requestIp(request)))
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many requests from this connection — wait a few minutes and try again.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: parsed.error.flatten(),
      });
    const assessment = assessSafety(parsed.data.message);
    const template = assessment.templateId
      ? getSafetyTemplate(assessment.templateId, parsed.data.language)
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
  async research(@Body() body: unknown, @Req() request: IpRequest) {
    if (!this.rateLimiter.allow(requestIp(request)))
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many questions from this connection — wait a few minutes and try again.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: parsed.error.flatten(),
      });
    const assessment = assessSafety(parsed.data.message);
    const template = assessment.templateId
      ? getSafetyTemplate(assessment.templateId, parsed.data.language)
      : null;
    if (assessment.interruptConversation) return { assessment, template, research: null };
    return {
      assessment,
      template: null,
      research: await this.healthResearch.research(parsed.data.message, parsed.data.language),
    };
  }
}
