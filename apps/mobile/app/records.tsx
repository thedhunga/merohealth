import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, ArrowLeft, Check, Pencil, Plus, X } from 'lucide-react-native';
import { isLowConfidence } from '@swasthya/health-records';
import type { TimelineEntry } from '@swasthya/health-records';
import type { HealthObservation, LanguageCode } from '@swasthya/shared-types';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Screen, uiStyles } from '@/components/ui';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { useAppState } from '@/state/app-state';
import { documentKindLabel } from '@/lib/document-kinds';
import {
  RecordsApiError,
  confirmObservation,
  correctObservation,
  listPendingConfirmations,
  listTimeline,
  rejectObservation,
} from '@/lib/records-api';

export default function RecordsScreen() {
  const { language, actingSubjects, activeSubject, switchActingSubject } = useAppState();
  const [pending, setPending] = useState<readonly HealthObservation[]>([]);
  const [timeline, setTimeline] = useState<readonly TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [draftUnit, setDraftUnit] = useState('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [pendingResult, timelineResult] = await Promise.all([
        listPendingConfirmations(activeSubject.id),
        listTimeline(activeSubject.id),
      ]);
      setPending(pendingResult);
      setTimeline(timelineResult);
    } catch {
      setLoadError(
        language === 'en'
          ? 'Could not load your records. Check your connection and try again.'
          : 'विवरण ल्याउन सकिएन। नेटवर्क जाँच गरेर पुनः प्रयास गर्नुहोस्।',
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeSubject.id, language]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (observationId: string, action: () => Promise<HealthObservation>) => {
    setBusyId(observationId);
    try {
      await action();
      setCorrectingId(null);
      await load();
    } catch (error) {
      setLoadError(
        error instanceof RecordsApiError
          ? error.message
          : language === 'en'
            ? 'That action failed. Try again.'
            : 'यो कार्य असफल भयो। फेरि प्रयास गर्नुहोस्।',
      );
    } finally {
      setBusyId(null);
    }
  };

  const startCorrection = (observation: HealthObservation) => {
    setCorrectingId(observation.id);
    setDraftValue(observation.value);
    setDraftUnit(observation.unit ?? '');
  };

  const submitCorrection = (observation: HealthObservation) => {
    if (!draftValue.trim()) return;
    void runAction(observation.id, () =>
      correctObservation(observation.id, activeSubject.id, draftValue.trim(), draftUnit.trim() || null),
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={language === 'en' ? 'Go back' : 'पछाडि जानुहोस्'}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'en' ? 'My documents' : 'मेरा कागजातहरू'}
        </Text>
        <Pressable onPress={() => router.push('/capture')} style={styles.addButton}>
          <Plus color="white" size={18} />
        </Pressable>
      </View>

      <ProfileSwitcher
        active={activeSubject}
        language={language}
        onSwitch={switchActingSubject}
        subjects={actingSubjects}
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          {loadError ? (
            <View style={styles.errorBanner}>
              <AlertTriangle color={colors.danger} size={18} />
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>
            {language === 'en' ? 'Awaiting confirmation' : 'पुष्टि पर्खिरहेको'}
          </Text>
          {pending.length === 0 ? (
            <Text style={styles.empty}>
              {language === 'en'
                ? 'Nothing to confirm yet. Extracted values will appear here once a document has been processed.'
                : 'अहिलेसम्म पुष्टि गर्नुपर्ने केही छैन। कागजातबाट निकालिएका मानहरू यहाँ देखिनेछन्।'}
            </Text>
          ) : (
            pending.map((observation) => (
              <View key={observation.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>
                    {language === 'en' ? observation.labelEn : observation.labelNe}
                  </Text>
                  {isLowConfidence(observation) ? (
                    <View style={styles.lowConfidenceBadge}>
                      <Text style={styles.lowConfidenceText}>
                        {language === 'en' ? 'LOW CONFIDENCE' : 'कम भरोसायोग्य'}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardValue}>
                  {observation.value}
                  {observation.unit ? ` ${observation.unit}` : ''}
                </Text>
                {observation.referenceRange ? (
                  <Text style={styles.cardMeta}>
                    {language === 'en' ? 'Reference range' : 'सामान्य सीमा'}: {observation.referenceRange}
                  </Text>
                ) : null}

                {correctingId === observation.id ? (
                  <View style={styles.correctionRow}>
                    <TextInput
                      accessibilityLabel={language === 'en' ? 'Corrected value' : 'सच्याइएको मान'}
                      onChangeText={setDraftValue}
                      style={[styles.correctionInput, styles.correctionValue]}
                      value={draftValue}
                    />
                    <TextInput
                      accessibilityLabel={language === 'en' ? 'Unit' : 'एकाइ'}
                      onChangeText={setDraftUnit}
                      placeholder={language === 'en' ? 'unit' : 'एकाइ'}
                      placeholderTextColor="#82918E"
                      style={[styles.correctionInput, styles.correctionUnit]}
                      value={draftUnit}
                    />
                    <Pressable
                      disabled={!draftValue.trim() || busyId === observation.id}
                      onPress={() => submitCorrection(observation)}
                      style={styles.correctionSubmit}
                    >
                      <Check color="white" size={16} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={busyId === observation.id}
                      onPress={() =>
                        void runAction(observation.id, () => confirmObservation(observation.id, activeSubject.id))
                      }
                      style={[styles.actionButton, styles.confirmButton]}
                    >
                      <Check color="white" size={16} />
                      <Text style={styles.confirmButtonText}>
                        {language === 'en' ? 'Confirm' : 'पुष्टि गर्नुहोस्'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === observation.id}
                      onPress={() => startCorrection(observation)}
                      style={[styles.actionButton, styles.correctButton]}
                    >
                      <Pencil color={colors.primaryDark} size={16} />
                      <Text style={styles.correctButtonText}>
                        {language === 'en' ? 'Correct' : 'सच्याउनुहोस्'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === observation.id}
                      onPress={() =>
                        void runAction(observation.id, () => rejectObservation(observation.id, activeSubject.id))
                      }
                      style={[styles.actionButton, styles.rejectButton]}
                    >
                      <X color={colors.danger} size={16} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>{language === 'en' ? 'Timeline' : 'समयरेखा'}</Text>
          {timeline.length === 0 ? (
            <Text style={styles.empty}>
              {language === 'en'
                ? 'No documents yet. Add your first one.'
                : 'अहिलेसम्म कुनै कागजात छैन। पहिलो थप्नुहोस्।'}
            </Text>
          ) : (
            timeline.map((entry) => <TimelineRow entry={entry} key={entry.documentId} language={language} />)
          )}
        </>
      )}
    </Screen>
  );
}

function TimelineRow({ entry, language }: { entry: TimelineEntry; language: LanguageCode }) {
  const kindLabel = documentKindLabel(entry.kind, language);
  const occurred = new Date(entry.occurredAt).toLocaleDateString(language === 'en' ? 'en-US' : 'ne-NP');

  return (
    <View style={styles.timelineRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.timelineTitle}>{entry.title}</Text>
        <Text style={styles.timelineMeta}>
          {kindLabel} · {occurred}
        </Text>
      </View>
      {entry.pendingCount > 0 ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>{entry.pendingCount}</Text>
        </View>
      ) : null}
      {entry.hasAbnormal ? <AlertTriangle color={colors.danger} size={16} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  back: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  headerTitle: { color: colors.ink, flex: 1, fontSize: 19, fontWeight: '900' },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  loading: { alignItems: 'center', padding: spacing.xxl },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, flex: 1, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: spacing.md },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: { ...uiStyles.card, gap: spacing.sm },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: '900' },
  lowConfidenceBadge: {
    backgroundColor: colors.saffronSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  lowConfidenceText: { color: colors.saffronDeep, fontSize: 9, fontWeight: '900' },
  cardValue: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  cardMeta: { color: colors.muted, fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  confirmButton: { backgroundColor: colors.primary, flex: 1 },
  confirmButtonText: { color: 'white', fontSize: 13, fontWeight: '900' },
  correctButton: { backgroundColor: colors.mint, flex: 1 },
  correctButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  rejectButton: { backgroundColor: colors.dangerSoft, width: 44 },
  correctionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  correctionInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  correctionValue: { flex: 2 },
  correctionUnit: { flex: 1 },
  correctionSubmit: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  timelineRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  timelineTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  timelineMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  pendingBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
  },
  pendingBadgeText: { color: 'white', fontSize: 10, fontWeight: '900' },
});
