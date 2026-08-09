import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { RecordsController } from './records.controller.js';
import { RecordsRepository } from './records.repository.js';
import { RecordsService } from './records.service.js';

function buildController(store = new InMemoryDocumentStore('HOSTED')) {
  const service = new RecordsService(new RecordsRepository(), store);
  return new RecordsController(service);
}

const validCapture = {
  ownerId: 'owner-1',
  filename: 'report.jpg',
  kind: 'LAB_REPORT',
  title: 'Blood panel',
  bytesBase64: Buffer.from('fake bytes').toString('base64'),
};

describe('RecordsController health', () => {
  it('reports UP', async () => {
    const controller = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

describe('RecordsController capture', () => {
  it('decodes base64 bytes and stores the document', async () => {
    const controller = buildController();
    const document = await controller.capture(validCapture);

    expect(document.status).toBe('STORED');
    expect(document.title).toBe('Blood panel');
  });

  it('rejects a request missing a required field', async () => {
    const controller = buildController();
    await expect(controller.capture({ ...validCapture, ownerId: undefined })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an unknown document kind rather than silently accepting it', async () => {
    const controller = buildController();
    await expect(
      controller.capture({ ...validCapture, kind: 'NOT_A_REAL_KIND' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RecordsController reads', () => {
  it('requires ownerId on the list endpoint', () => {
    const controller = buildController();
    expect(() => controller.list(undefined)).toThrow(BadRequestException);
  });

  it('lists documents captured for the given owner', async () => {
    const controller = buildController();
    await controller.capture(validCapture);

    const result = controller.list('owner-1');
    expect(result.total).toBe(1);
  });

  it('requires ownerId on the timeline endpoint', () => {
    const controller = buildController();
    expect(() => controller.timeline(undefined)).toThrow(BadRequestException);
  });

  it('returns a timeline entry per captured document', async () => {
    const controller = buildController();
    await controller.capture(validCapture);

    const result = controller.timeline('owner-1');
    expect(result.total).toBe(1);
  });

  it('404s for observations of an unknown document', () => {
    const controller = buildController();
    expect(() => controller.observationsForDocument('missing')).toThrow(NotFoundException);
  });
});

describe('RecordsController observation actions', () => {
  it('confirm/correct/reject 404 for an unknown observation', () => {
    const controller = buildController();
    expect(() => controller.confirm('missing')).toThrow(NotFoundException);
    expect(() => controller.correct('missing', { value: '1' })).toThrow(NotFoundException);
    expect(() => controller.reject('missing')).toThrow(NotFoundException);
  });

  it('rejects a correct body with no value', () => {
    const controller = buildController();
    expect(() => controller.correct('any-id', {})).toThrow(BadRequestException);
  });
});
