import type { DeviceMetricKind, DeviceSample, DeviceSource } from '@swasthya/shared-types';

/**
 * Normalisation from wearable/platform readings into `DeviceSample`.
 *
 * Health Connect (Android) and HealthKit (iOS) each expose their own record
 * shapes, units and quirks. This package's only job is to turn one platform
 * record into zero or more `DeviceSample`s in this repo's canonical units —
 * everything downstream (`digital-twin`, the assistant, trends) reads one
 * shape regardless of which device produced it.
 *
 * This package does not assign `DeviceSample.id` or persist anything, on the
 * same principle `records.service.ts` already follows for `HealthDocument`:
 * id generation belongs to the repository that owns storage, not the domain
 * package that only shapes data. `sourceRecordId` below carries the
 * platform's own record/sample id forward so a future repository can use it
 * as an idempotency key when the same device re-reports a sample it already
 * synced.
 */
export interface NormalizedDeviceSample extends Omit<DeviceSample, 'id'> {
  sourceRecordId: string;
}

export class InvalidDeviceRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDeviceRecordError';
  }
}

export class UnsupportedDeviceRecordError extends Error {
  constructor(recordType: string) {
    super(`Unsupported device record type: ${recordType}`);
    this.name = 'UnsupportedDeviceRecordError';
  }
}

/**
 * Canonical unit stored for each metric, independent of source platform.
 * `STEPS` matches the unit already used by `packages/database`'s seed data;
 * the rest follow this repo's existing lab-panel convention of `mg/dL` (see
 * `packages/health-records`) over SI alternatives, so a person's device data
 * and their lab results read in comparable units without a second lookup.
 */
export const CANONICAL_UNIT: Readonly<Record<DeviceMetricKind, string>> = {
  STEPS: 'steps',
  HEART_RATE: 'bpm',
  RESTING_HEART_RATE: 'bpm',
  SLEEP_DURATION: 'min',
  BLOOD_OXYGEN: '%',
  BLOOD_GLUCOSE: 'mg/dL',
  BLOOD_PRESSURE_SYSTOLIC: 'mmHg',
  BLOOD_PRESSURE_DIASTOLIC: 'mmHg',
  BODY_WEIGHT: 'kg',
  BODY_TEMPERATURE: '°C',
  RESPIRATORY_RATE: 'breaths/min',
};

/* ------------------------------------------------------------------ *
 * Unit conversion
 *
 * Every factor here is a published physical/clinical constant, not a guess:
 * glucose's 18.0182 mg/dL per mmol/L comes from glucose's molar mass
 * (180.16 g/mol) divided by 10 (dL per L, mg per g); the pound is the
 * international avoirdupois pound, exact by definition since 1959.
 * ------------------------------------------------------------------ */

const MMOL_PER_L_TO_MG_PER_DL_GLUCOSE = 18.0182;
const KG_PER_LB = 0.45359237;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function glucoseToMgPerDl(value: number, unit: 'mg/dL' | 'mmol/L'): number {
  return unit === 'mg/dL' ? round(value, 0) : round(value * MMOL_PER_L_TO_MG_PER_DL_GLUCOSE, 0);
}

function massToKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? round(value, 1) : round(value * KG_PER_LB, 1);
}

function temperatureToCelsius(value: number, unit: 'celsius' | 'fahrenheit'): number {
  return unit === 'celsius' ? round(value, 1) : round(((value - 32) * 5) / 9, 1);
}

/** HealthKit's `HKUnit.percent()` reports oxygen saturation as a 0.0-1.0 fraction. */
function oxygenSaturationToPercent(value: number, isFraction: boolean): number {
  return round(isFraction ? value * 100 : value, 0);
}

function minutesBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new InvalidDeviceRecordError(`Unparseable timestamp: ${startIso} / ${endIso}`);
  }
  if (end < start) {
    throw new InvalidDeviceRecordError(`Record end (${endIso}) precedes start (${startIso})`);
  }
  return round((end - start) / 60_000, 0);
}

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new InvalidDeviceRecordError(`Non-finite ${field}: ${value}`);
  }
}

/* ------------------------------------------------------------------ *
 * Health Connect (androidx.health.connect.client.records)
 *
 * Field names below mirror the real Health Connect record classes as a JS
 * bridge would flatten them: `metadata.id` is the platform's own UUID for
 * the record, `time`/`startTime`/`endTime` are ISO-8601 instants.
 * ------------------------------------------------------------------ */

export interface HealthConnectDevice {
  manufacturer?: string;
  model?: string;
}

export interface HealthConnectMetadata {
  id: string;
  device?: HealthConnectDevice;
}

export interface HealthConnectStepsRecord {
  recordType: 'StepsRecord';
  metadata: HealthConnectMetadata;
  count: number;
  startTime: string;
  endTime: string;
}

export interface HealthConnectHeartRateRecord {
  recordType: 'HeartRateRecord';
  metadata: HealthConnectMetadata;
  startTime: string;
  endTime: string;
  samples: ReadonlyArray<{ time: string; beatsPerMinute: number }>;
}

export interface HealthConnectRestingHeartRateRecord {
  recordType: 'RestingHeartRateRecord';
  metadata: HealthConnectMetadata;
  time: string;
  beatsPerMinute: number;
}

/**
 * Health Connect's sleep stage type codes
 * (`androidx.health.connect.client.records.SleepSessionRecord.Stage`).
 * `AWAKE`/`AWAKE_IN_BED`/`OUT_OF_BED`/`UNKNOWN` are deliberately excluded
 * from what counts as sleep below.
 */
export type HealthConnectSleepStageType =
  | 'AWAKE' | 'SLEEPING' | 'OUT_OF_BED' | 'LIGHT' | 'DEEP' | 'REM' | 'AWAKE_IN_BED' | 'UNKNOWN';

const HEALTH_CONNECT_ASLEEP_STAGES: ReadonlySet<HealthConnectSleepStageType> = new Set([
  'SLEEPING',
  'LIGHT',
  'DEEP',
  'REM',
]);

export interface HealthConnectSleepSessionRecord {
  recordType: 'SleepSessionRecord';
  metadata: HealthConnectMetadata;
  startTime: string;
  endTime: string;
  stages?: ReadonlyArray<{ startTime: string; endTime: string; stage: HealthConnectSleepStageType }>;
}

export interface HealthConnectOxygenSaturationRecord {
  recordType: 'OxygenSaturationRecord';
  metadata: HealthConnectMetadata;
  time: string;
  /** Already 0-100; Health Connect's `Percentage.value` is not a fraction. */
  percentage: number;
}

export interface HealthConnectBloodGlucoseRecord {
  recordType: 'BloodGlucoseRecord';
  metadata: HealthConnectMetadata;
  time: string;
  level: number;
  unit: 'mg/dL' | 'mmol/L';
}

export interface HealthConnectBloodPressureRecord {
  recordType: 'BloodPressureRecord';
  metadata: HealthConnectMetadata;
  time: string;
  systolic: number;
  diastolic: number;
}

export interface HealthConnectWeightRecord {
  recordType: 'WeightRecord';
  metadata: HealthConnectMetadata;
  time: string;
  weight: number;
  unit: 'kg' | 'lb';
}

export interface HealthConnectBodyTemperatureRecord {
  recordType: 'BodyTemperatureRecord';
  metadata: HealthConnectMetadata;
  time: string;
  temperature: number;
  unit: 'celsius' | 'fahrenheit';
}

export interface HealthConnectRespiratoryRateRecord {
  recordType: 'RespiratoryRateRecord';
  metadata: HealthConnectMetadata;
  time: string;
  rate: number;
}

export type HealthConnectRecord =
  | HealthConnectStepsRecord
  | HealthConnectHeartRateRecord
  | HealthConnectRestingHeartRateRecord
  | HealthConnectSleepSessionRecord
  | HealthConnectOxygenSaturationRecord
  | HealthConnectBloodGlucoseRecord
  | HealthConnectBloodPressureRecord
  | HealthConnectWeightRecord
  | HealthConnectBodyTemperatureRecord
  | HealthConnectRespiratoryRateRecord;

function deviceLabelFrom(device: { manufacturer?: string; model?: string } | undefined): string | null {
  if (!device) return null;
  const label = [device.manufacturer, device.model].filter((part): part is string => !!part).join(' ');
  return label.length > 0 ? label : null;
}

export function normalizeHealthConnectRecord(
  record: HealthConnectRecord,
  ownerId: string,
): readonly NormalizedDeviceSample[] {
  const source: DeviceSource = 'HEALTH_CONNECT';
  const deviceLabel = deviceLabelFrom(record.metadata.device);

  switch (record.recordType) {
    case 'StepsRecord': {
      assertFinite(record.count, 'count');
      return [
        sample({
          sourceRecordId: record.metadata.id,
          ownerId,
          kind: 'STEPS',
          source,
          deviceLabel,
          value: round(record.count, 0),
          recordedAt: record.startTime,
          recordedUntil: record.endTime,
        }),
      ];
    }

    case 'HeartRateRecord': {
      return record.samples.map((s, index) => {
        assertFinite(s.beatsPerMinute, 'beatsPerMinute');
        return sample({
          sourceRecordId: `${record.metadata.id}:${index}`,
          ownerId,
          kind: 'HEART_RATE',
          source,
          deviceLabel,
          value: round(s.beatsPerMinute, 0),
          recordedAt: s.time,
          recordedUntil: null,
        });
      });
    }

    case 'RestingHeartRateRecord': {
      assertFinite(record.beatsPerMinute, 'beatsPerMinute');
      return [
        sample({
          sourceRecordId: record.metadata.id,
          ownerId,
          kind: 'RESTING_HEART_RATE',
          source,
          deviceLabel,
          value: round(record.beatsPerMinute, 0),
          recordedAt: record.time,
          recordedUntil: null,
        }),
      ];
    }

    case 'SleepSessionRecord': {
      const stages = record.stages;
      if (!stages || stages.length === 0) {
        return [
          sample({
            sourceRecordId: record.metadata.id,
            ownerId,
            kind: 'SLEEP_DURATION',
            source,
            deviceLabel,
            value: minutesBetween(record.startTime, record.endTime),
            recordedAt: record.startTime,
            recordedUntil: record.endTime,
          }),
        ];
      }
      return stages
        .filter((stage) => HEALTH_CONNECT_ASLEEP_STAGES.has(stage.stage))
        .map((stage, index) =>
          sample({
            sourceRecordId: `${record.metadata.id}:${index}`,
            ownerId,
            kind: 'SLEEP_DURATION',
            source,
            deviceLabel,
            value: minutesBetween(stage.startTime, stage.endTime),
            recordedAt: stage.startTime,
            recordedUntil: stage.endTime,
          }),
        );
    }

    case 'OxygenSaturationRecord': {
      assertFinite(record.percentage, 'percentage');
      return [
        sample({
          sourceRecordId: record.metadata.id,
          ownerId,
          kind: 'BLOOD_OXYGEN',
          source,
          deviceLabel,
          value: oxygenSaturationToPercent(record.percentage, false),
          recordedAt: record.time,
          recordedUntil: null,
        }),
      ];
    }

    case 'BloodGlucoseRecord': {
      assertFinite(record.level, 'level');
      return [
        sample({
          sourceRecordId: record.metadata.id,
          ownerId,
          kind: 'BLOOD_GLUCOSE',
          source,
          deviceLabel,
          value: glucoseToMgPerDl(record.level, record.unit),
          recordedAt: record.time,
          recordedUntil: null,
        }),
      ];
    }

    case 'BloodPressureRecord': {
      assertFinite(record.systolic, 'systolic');
      assertFinite(record.diastolic, 'diastolic');
      return [
        sample({
          sourceRecordId: `${record.metadata.id}:systolic`,
          ownerId,
          kind: 'BLOOD_PRESSURE_SYSTOLIC',
          source,
          deviceLabel,
          value: round(record.systolic, 0),
          recordedAt: record.time,
          recordedUntil: null,
        }),
        sample({
          sourceRecordId: `${record.metadata.id}:diastolic`,
          ownerId,
          kind: 'BLOOD_PRESSURE_DIASTOLIC',
          source,
          deviceLabel,
          value: round(record.diastolic, 0),
          recordedAt: record.time,
          recordedUntil: null,
        }),
      ];
    }

    case 'WeightRecord': {
      assertFinite(record.weight, 'weight');
      return [
        sample({
          sourceRecordId: record.metadata.id,
          ownerId,
          kind: 'BODY_WEIGHT',
          source,
          deviceLabel,
          value: massToKg(record.weight, record.unit),
          recordedAt: record.time,
          recordedUntil: null,
        }),
      ];
    }

    case 'BodyTemperatureRecord': {
      assertFinite(record.temperature, 'temperature');
      return [
        sample({
          sourceRecordId: record.metadata.id,
          ownerId,
          kind: 'BODY_TEMPERATURE',
          source,
          deviceLabel,
          value: temperatureToCelsius(record.temperature, record.unit),
          recordedAt: record.time,
          recordedUntil: null,
        }),
      ];
    }

    case 'RespiratoryRateRecord': {
      assertFinite(record.rate, 'rate');
      return [
        sample({
          sourceRecordId: record.metadata.id,
          ownerId,
          kind: 'RESPIRATORY_RATE',
          source,
          deviceLabel,
          value: round(record.rate, 0),
          recordedAt: record.time,
          recordedUntil: null,
        }),
      ];
    }

    default: {
      const exhaustive: never = record;
      throw new UnsupportedDeviceRecordError(String((exhaustive as { recordType?: string }).recordType));
    }
  }
}

/* ------------------------------------------------------------------ *
 * HealthKit
 *
 * Identifiers below are Apple's own stable HKQuantityTypeIdentifier /
 * HKCategoryTypeIdentifier constants, used as the discriminant a JS bridge
 * would report them under. `uuid` is `HKObject.uuid`, already a real UUID
 * per sample.
 * ------------------------------------------------------------------ */

export interface HealthKitDevice {
  manufacturer?: string;
  model?: string;
}

interface HealthKitQuantitySampleBase {
  uuid: string;
  startDate: string;
  endDate: string;
  value: number;
  device?: HealthKitDevice;
}

export interface HealthKitStepCountSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierStepCount';
}

export interface HealthKitHeartRateSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierHeartRate';
}

export interface HealthKitRestingHeartRateSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierRestingHeartRate';
}

export interface HealthKitOxygenSaturationSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierOxygenSaturation';
  /** `HKUnit.percent()` values are a 0.0-1.0 fraction, not 0-100. */
  isFraction: boolean;
}

export interface HealthKitBloodGlucoseSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierBloodGlucose';
  unit: 'mg/dL' | 'mmol/L';
}

export interface HealthKitBloodPressureSystolicSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierBloodPressureSystolic';
}

export interface HealthKitBloodPressureDiastolicSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierBloodPressureDiastolic';
}

export interface HealthKitBodyMassSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierBodyMass';
  unit: 'kg' | 'lb';
}

export interface HealthKitBodyTemperatureSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierBodyTemperature';
  unit: 'degC' | 'degF';
}

export interface HealthKitRespiratoryRateSample extends HealthKitQuantitySampleBase {
  identifier: 'HKQuantityTypeIdentifierRespiratoryRate';
}

/**
 * `HKCategoryValueSleepAnalysis` as a JS bridge commonly flattens it. Apple's
 * underlying raw values are integers (inBed=0, asleepUnspecified=1, awake=2,
 * asleepCore=3, asleepDeep=4, asleepREM=5); `INBED`/`AWAKE` are excluded from
 * what counts as sleep below, matching the Health Connect stage filter.
 */
export type HealthKitSleepValue = 'INBED' | 'ASLEEP' | 'ASLEEP_CORE' | 'ASLEEP_DEEP' | 'ASLEEP_REM' | 'AWAKE';

const HEALTH_KIT_ASLEEP_VALUES: ReadonlySet<HealthKitSleepValue> = new Set([
  'ASLEEP',
  'ASLEEP_CORE',
  'ASLEEP_DEEP',
  'ASLEEP_REM',
]);

export interface HealthKitSleepAnalysisSample {
  identifier: 'HKCategoryTypeIdentifierSleepAnalysis';
  uuid: string;
  startDate: string;
  endDate: string;
  value: HealthKitSleepValue;
  device?: HealthKitDevice;
}

export type HealthKitSample =
  | HealthKitStepCountSample
  | HealthKitHeartRateSample
  | HealthKitRestingHeartRateSample
  | HealthKitOxygenSaturationSample
  | HealthKitBloodGlucoseSample
  | HealthKitBloodPressureSystolicSample
  | HealthKitBloodPressureDiastolicSample
  | HealthKitBodyMassSample
  | HealthKitBodyTemperatureSample
  | HealthKitRespiratoryRateSample
  | HealthKitSleepAnalysisSample;

export function normalizeHealthKitSample(
  raw: HealthKitSample,
  ownerId: string,
): readonly NormalizedDeviceSample[] {
  const source: DeviceSource = 'HEALTH_KIT';
  const deviceLabel = deviceLabelFrom(raw.device);

  switch (raw.identifier) {
    case 'HKQuantityTypeIdentifierStepCount': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'STEPS',
          source,
          deviceLabel,
          value: round(raw.value, 0),
          recordedAt: raw.startDate,
          recordedUntil: raw.endDate,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierHeartRate': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'HEART_RATE',
          source,
          deviceLabel,
          value: round(raw.value, 0),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierRestingHeartRate': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'RESTING_HEART_RATE',
          source,
          deviceLabel,
          value: round(raw.value, 0),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierOxygenSaturation': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'BLOOD_OXYGEN',
          source,
          deviceLabel,
          value: oxygenSaturationToPercent(raw.value, raw.isFraction),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierBloodGlucose': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'BLOOD_GLUCOSE',
          source,
          deviceLabel,
          value: glucoseToMgPerDl(raw.value, raw.unit),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierBloodPressureSystolic': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'BLOOD_PRESSURE_SYSTOLIC',
          source,
          deviceLabel,
          value: round(raw.value, 0),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierBloodPressureDiastolic': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'BLOOD_PRESSURE_DIASTOLIC',
          source,
          deviceLabel,
          value: round(raw.value, 0),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierBodyMass': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'BODY_WEIGHT',
          source,
          deviceLabel,
          value: massToKg(raw.value, raw.unit),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierBodyTemperature': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'BODY_TEMPERATURE',
          source,
          deviceLabel,
          value: temperatureToCelsius(raw.value, raw.unit === 'degC' ? 'celsius' : 'fahrenheit'),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKQuantityTypeIdentifierRespiratoryRate': {
      assertFinite(raw.value, 'value');
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'RESPIRATORY_RATE',
          source,
          deviceLabel,
          value: round(raw.value, 0),
          recordedAt: raw.startDate,
          recordedUntil: null,
        }),
      ];
    }

    case 'HKCategoryTypeIdentifierSleepAnalysis': {
      if (!HEALTH_KIT_ASLEEP_VALUES.has(raw.value)) return [];
      return [
        sample({
          sourceRecordId: raw.uuid,
          ownerId,
          kind: 'SLEEP_DURATION',
          source,
          deviceLabel,
          value: minutesBetween(raw.startDate, raw.endDate),
          recordedAt: raw.startDate,
          recordedUntil: raw.endDate,
        }),
      ];
    }

    default: {
      const exhaustive: never = raw;
      throw new UnsupportedDeviceRecordError(String((exhaustive as { identifier?: string }).identifier));
    }
  }
}

function sample(input: {
  sourceRecordId: string;
  ownerId: string;
  kind: DeviceMetricKind;
  source: DeviceSource;
  deviceLabel: string | null;
  value: number;
  recordedAt: string;
  recordedUntil: string | null;
}): NormalizedDeviceSample {
  return {
    sourceRecordId: input.sourceRecordId,
    ownerId: input.ownerId,
    kind: input.kind,
    source: input.source,
    deviceLabel: input.deviceLabel,
    value: input.value,
    unit: CANONICAL_UNIT[input.kind],
    recordedAt: input.recordedAt,
    recordedUntil: input.recordedUntil,
  };
}
