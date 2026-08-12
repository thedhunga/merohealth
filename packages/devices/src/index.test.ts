import { describe, expect, it } from 'vitest';

import {
  CANONICAL_UNIT,
  InvalidDeviceRecordError,
  UnsupportedDeviceRecordError,
  normalizeHealthConnectRecord,
  normalizeHealthKitSample,
  type HealthConnectRecord,
  type HealthKitSample,
} from './index';

const OWNER = 'owner-1';

describe('normalizeHealthConnectRecord', () => {
  it('normalises steps as a windowed aggregate', () => {
    const record: HealthConnectRecord = {
      recordType: 'StepsRecord',
      metadata: { id: 'hc-1' },
      count: 6423,
      startTime: '2026-06-01T00:00:00.000Z',
      endTime: '2026-06-01T23:59:59.000Z',
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result).toEqual({
      sourceRecordId: 'hc-1',
      ownerId: OWNER,
      kind: 'STEPS',
      source: 'HEALTH_CONNECT',
      deviceLabel: null,
      value: 6423,
      unit: 'steps',
      recordedAt: '2026-06-01T00:00:00.000Z',
      recordedUntil: '2026-06-01T23:59:59.000Z',
    });
  });

  it('carries device manufacturer/model into deviceLabel', () => {
    const record: HealthConnectRecord = {
      recordType: 'RestingHeartRateRecord',
      metadata: { id: 'hc-2', device: { manufacturer: 'Google', model: 'Pixel Watch' } },
      time: '2026-06-01T06:00:00.000Z',
      beatsPerMinute: 58,
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.deviceLabel).toBe('Google Pixel Watch');
  });

  it('expands a heart rate record into one sample per reading, indexed off the record id', () => {
    const record: HealthConnectRecord = {
      recordType: 'HeartRateRecord',
      metadata: { id: 'hc-3' },
      startTime: '2026-06-01T06:00:00.000Z',
      endTime: '2026-06-01T06:02:00.000Z',
      samples: [
        { time: '2026-06-01T06:00:00.000Z', beatsPerMinute: 72 },
        { time: '2026-06-01T06:01:00.000Z', beatsPerMinute: 75 },
      ],
    };
    const result = normalizeHealthConnectRecord(record, OWNER);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.sourceRecordId)).toEqual(['hc-3:0', 'hc-3:1']);
    expect(result.map((s) => s.value)).toEqual([72, 75]);
    expect(result.every((s) => s.recordedUntil === null)).toBe(true);
  });

  it('drops awake/unknown sleep stages and sums only asleep ones', () => {
    const record: HealthConnectRecord = {
      recordType: 'SleepSessionRecord',
      metadata: { id: 'hc-4' },
      startTime: '2026-06-01T22:00:00.000Z',
      endTime: '2026-06-02T06:00:00.000Z',
      stages: [
        { startTime: '2026-06-01T22:00:00.000Z', endTime: '2026-06-01T22:20:00.000Z', stage: 'AWAKE' },
        { startTime: '2026-06-01T22:20:00.000Z', endTime: '2026-06-02T00:20:00.000Z', stage: 'LIGHT' },
        { startTime: '2026-06-02T00:20:00.000Z', endTime: '2026-06-02T02:20:00.000Z', stage: 'DEEP' },
      ],
    };
    const result = normalizeHealthConnectRecord(record, OWNER);
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.kind === 'SLEEP_DURATION')).toBe(true);
    expect(result.map((s) => s.value)).toEqual([120, 120]);
  });

  it('falls back to the full session span when no stages are reported', () => {
    const record: HealthConnectRecord = {
      recordType: 'SleepSessionRecord',
      metadata: { id: 'hc-5' },
      startTime: '2026-06-01T22:00:00.000Z',
      endTime: '2026-06-02T05:30:00.000Z',
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.value).toBe(450);
  });

  it('converts glucose from mmol/L to the canonical mg/dL', () => {
    const record: HealthConnectRecord = {
      recordType: 'BloodGlucoseRecord',
      metadata: { id: 'hc-6' },
      time: '2026-06-01T07:00:00.000Z',
      level: 5.5,
      unit: 'mmol/L',
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.value).toBe(99);
    expect(result?.unit).toBe('mg/dL');
  });

  it('leaves mg/dL glucose untouched', () => {
    const record: HealthConnectRecord = {
      recordType: 'BloodGlucoseRecord',
      metadata: { id: 'hc-7' },
      time: '2026-06-01T07:00:00.000Z',
      level: 95,
      unit: 'mg/dL',
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.value).toBe(95);
  });

  it('splits blood pressure into a systolic and a diastolic sample sharing recordedAt', () => {
    const record: HealthConnectRecord = {
      recordType: 'BloodPressureRecord',
      metadata: { id: 'hc-8' },
      time: '2026-06-01T07:00:00.000Z',
      systolic: 118,
      diastolic: 76,
    };
    const result = normalizeHealthConnectRecord(record, OWNER);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.kind)).toEqual(['BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC']);
    expect(result.map((s) => s.value)).toEqual([118, 76]);
    expect(result.every((s) => s.recordedAt === '2026-06-01T07:00:00.000Z')).toBe(true);
    expect(result.every((s) => s.unit === 'mmHg')).toBe(true);
  });

  it('converts weight from lb to kg', () => {
    const record: HealthConnectRecord = {
      recordType: 'WeightRecord',
      metadata: { id: 'hc-9' },
      time: '2026-06-01T07:00:00.000Z',
      weight: 154,
      unit: 'lb',
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.value).toBeCloseTo(69.9, 1);
    expect(result?.unit).toBe('kg');
  });

  it('converts temperature from fahrenheit to celsius', () => {
    const record: HealthConnectRecord = {
      recordType: 'BodyTemperatureRecord',
      metadata: { id: 'hc-10' },
      time: '2026-06-01T07:00:00.000Z',
      temperature: 98.6,
      unit: 'fahrenheit',
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.value).toBeCloseTo(37, 1);
  });

  it('passes oxygen saturation through unchanged (already 0-100)', () => {
    const record: HealthConnectRecord = {
      recordType: 'OxygenSaturationRecord',
      metadata: { id: 'hc-11' },
      time: '2026-06-01T07:00:00.000Z',
      percentage: 97,
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.value).toBe(97);
    expect(result?.unit).toBe('%');
  });

  it('normalises respiratory rate', () => {
    const record: HealthConnectRecord = {
      recordType: 'RespiratoryRateRecord',
      metadata: { id: 'hc-12' },
      time: '2026-06-01T07:00:00.000Z',
      rate: 16,
    };
    const [result] = normalizeHealthConnectRecord(record, OWNER);
    expect(result?.value).toBe(16);
    expect(result?.unit).toBe('breaths/min');
  });

  it('rejects a non-finite reading rather than silently storing it', () => {
    const record: HealthConnectRecord = {
      recordType: 'RestingHeartRateRecord',
      metadata: { id: 'hc-13' },
      time: '2026-06-01T06:00:00.000Z',
      beatsPerMinute: Number.NaN,
    };
    expect(() => normalizeHealthConnectRecord(record, OWNER)).toThrow(InvalidDeviceRecordError);
  });

  it('rejects a session whose end precedes its start', () => {
    const record: HealthConnectRecord = {
      recordType: 'SleepSessionRecord',
      metadata: { id: 'hc-14' },
      startTime: '2026-06-02T06:00:00.000Z',
      endTime: '2026-06-01T22:00:00.000Z',
    };
    expect(() => normalizeHealthConnectRecord(record, OWNER)).toThrow(InvalidDeviceRecordError);
  });

  it('rejects an unrecognised record type instead of dropping it silently', () => {
    const record = { recordType: 'DietaryEnergyRecord', metadata: { id: 'hc-15' } } as unknown as HealthConnectRecord;
    expect(() => normalizeHealthConnectRecord(record, OWNER)).toThrow(UnsupportedDeviceRecordError);
  });

  it('every DeviceMetricKind has a canonical unit assigned', () => {
    expect(Object.keys(CANONICAL_UNIT).length).toBeGreaterThanOrEqual(11);
  });
});

describe('normalizeHealthKitSample', () => {
  it('normalises step count', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierStepCount',
      uuid: 'hk-1',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-01T23:59:59.000Z',
      value: 8120,
    };
    const [result] = normalizeHealthKitSample(raw, OWNER);
    expect(result?.kind).toBe('STEPS');
    expect(result?.value).toBe(8120);
    expect(result?.recordedUntil).toBe('2026-06-01T23:59:59.000Z');
  });

  it('converts the HKUnit.percent() fraction to a 0-100 saturation reading', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierOxygenSaturation',
      uuid: 'hk-2',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 0.98,
      isFraction: true,
    };
    const [result] = normalizeHealthKitSample(raw, OWNER);
    expect(result?.value).toBe(98);
  });

  it('leaves an already-percent oxygen saturation reading unchanged', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierOxygenSaturation',
      uuid: 'hk-3',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 98,
      isFraction: false,
    };
    const [result] = normalizeHealthKitSample(raw, OWNER);
    expect(result?.value).toBe(98);
  });

  it('normalises blood pressure systolic and diastolic as independent samples', () => {
    const systolic: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierBloodPressureSystolic',
      uuid: 'hk-4',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 122,
    };
    const diastolic: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
      uuid: 'hk-5',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 80,
    };
    const [sys] = normalizeHealthKitSample(systolic, OWNER);
    const [dia] = normalizeHealthKitSample(diastolic, OWNER);
    expect(sys?.kind).toBe('BLOOD_PRESSURE_SYSTOLIC');
    expect(sys?.value).toBe(122);
    expect(dia?.kind).toBe('BLOOD_PRESSURE_DIASTOLIC');
    expect(dia?.value).toBe(80);
    expect(sys?.recordedAt).toBe(dia?.recordedAt);
  });

  it('converts mmol/L glucose to the canonical mg/dL', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierBloodGlucose',
      uuid: 'hk-6',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 6.1,
      unit: 'mmol/L',
    };
    const [result] = normalizeHealthKitSample(raw, OWNER);
    expect(result?.value).toBe(110);
  });

  it('converts body mass from lb to the canonical kg', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierBodyMass',
      uuid: 'hk-body-mass-1',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 154,
      unit: 'lb',
    };
    const [result] = normalizeHealthKitSample(raw, OWNER);
    expect(result?.kind).toBe('BODY_WEIGHT');
    expect(result?.value).toBeCloseTo(69.9, 1);
    expect(result?.unit).toBe('kg');
  });

  it('converts body temperature reported in degF', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierBodyTemperature',
      uuid: 'hk-7',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 100.4,
      unit: 'degF',
    };
    const [result] = normalizeHealthKitSample(raw, OWNER);
    expect(result?.value).toBeCloseTo(38, 1);
  });

  it('sums only asleep sleep-analysis samples, dropping inBed and awake', () => {
    const inBed: HealthKitSample = {
      identifier: 'HKCategoryTypeIdentifierSleepAnalysis',
      uuid: 'hk-8',
      startDate: '2026-06-01T22:00:00.000Z',
      endDate: '2026-06-01T22:15:00.000Z',
      value: 'INBED',
    };
    const asleep: HealthKitSample = {
      identifier: 'HKCategoryTypeIdentifierSleepAnalysis',
      uuid: 'hk-9',
      startDate: '2026-06-01T22:15:00.000Z',
      endDate: '2026-06-02T05:15:00.000Z',
      value: 'ASLEEP_CORE',
    };
    expect(normalizeHealthKitSample(inBed, OWNER)).toEqual([]);
    const [result] = normalizeHealthKitSample(asleep, OWNER);
    expect(result?.kind).toBe('SLEEP_DURATION');
    expect(result?.value).toBe(420);
  });

  it('rejects a non-finite reading', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierHeartRate',
      uuid: 'hk-10',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: Number.POSITIVE_INFINITY,
    };
    expect(() => normalizeHealthKitSample(raw, OWNER)).toThrow(InvalidDeviceRecordError);
  });

  it('rejects an unrecognised identifier instead of guessing what it maps to', () => {
    const raw = {
      identifier: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      uuid: 'hk-11',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 500,
    } as unknown as HealthKitSample;
    expect(() => normalizeHealthKitSample(raw, OWNER)).toThrow(UnsupportedDeviceRecordError);
  });

  it('preserves the device-reported model string as deviceLabel, model-only', () => {
    const raw: HealthKitSample = {
      identifier: 'HKQuantityTypeIdentifierHeartRate',
      uuid: 'hk-12',
      startDate: '2026-06-01T07:00:00.000Z',
      endDate: '2026-06-01T07:00:00.000Z',
      value: 70,
      device: { model: 'Apple Watch' },
    };
    const [result] = normalizeHealthKitSample(raw, OWNER);
    expect(result?.deviceLabel).toBe('Apple Watch');
  });
});
