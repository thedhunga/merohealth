import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ShieldCheck, User, X } from 'lucide-react-native';
import type { LanguageCode } from '@swasthya/shared-types';
import { colors, radii, spacing } from '@swasthya/configuration';
import type { ActingSubject } from '@/lib/acting-subjects';

/**
 * family-and-proxy.md §1: the client-side switcher, without the ownership
 * being wrong underneath. Two rules drive every choice below:
 *
 * - **Always show whose record is open.** The pill renders unconditionally,
 *   even with a single SELF subject — "whose record is open" must never be
 *   something a person has to infer from context.
 * - **Never let acting for someone else look like acting for yourself.**
 *   Anything other than SELF gets a distinct visual treatment (icon, tone
 *   and a role suffix), not the same pill with a different name in it.
 */
export function ProfileSwitcher({
  subjects,
  active,
  onSwitch,
  language,
}: {
  subjects: readonly ActingSubject[];
  active: ActingSubject;
  onSwitch: (subjectId: string) => void;
  language: LanguageCode;
}) {
  const [open, setOpen] = useState(false);
  const canSwitch = subjects.length > 1;

  return (
    <>
      <Pressable
        accessibilityLabel={
          language === 'en' ? `Acting as ${active.displayName}` : `${active.displayName}को रूपमा`
        }
        accessibilityRole="button"
        disabled={!canSwitch}
        onPress={() => setOpen(true)}
        style={[styles.pill, active.relationship !== 'SELF' && styles.pillDelegated]}
      >
        {active.relationship === 'SELF' ? (
          <User color={colors.primaryDark} size={13} />
        ) : (
          <ShieldCheck color={colors.saffronDeep} size={13} />
        )}
        <Text style={[styles.pillText, active.relationship !== 'SELF' && styles.pillTextDelegated]}>
          {active.displayName}
          {active.relationship === 'GUARDIAN'
            ? language === 'en' ? ' · guardian' : ' · अभिभावक'
            : active.relationship === 'DELEGATE'
              ? language === 'en' ? ' · delegate' : ' · प्रतिनिधि'
              : ''}
        </Text>
        {canSwitch ? <ChevronDown color={colors.muted} size={13} /> : null}
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <Pressable onPress={() => setOpen(false)} style={styles.backdrop}>
          {/* Bare `View`s don't claim the touch responder, so a tap landing on the
              title, padding or gaps between rows — anywhere that isn't itself a
              Pressable — falls through to the backdrop above and dismisses the
              whole sheet. `accessible={false}` keeps this wrapper out of the a11y
              tree so the title/close button/options are still each announced on
              their own, the way task UU's audit already relies on. */}
          <Pressable accessible={false} onPress={() => {}} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {language === 'en' ? 'Whose record is open?' : 'कसको विवरण खुला छ?'}
              </Text>
              <Pressable
                accessibilityLabel={language === 'en' ? 'Close' : 'बन्द गर्नुहोस्'}
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.closeButton}
              >
                <X color={colors.muted} size={18} />
              </Pressable>
            </View>
            {subjects.map((subject) => (
              <Pressable
                accessibilityRole="button"
                key={subject.id}
                onPress={() => {
                  onSwitch(subject.id);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <Text style={styles.optionText}>{subject.displayName}</Text>
                {subject.id === active.id ? <Check color={colors.primary} size={16} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pillDelegated: { backgroundColor: colors.saffronSoft, borderColor: colors.saffronDeep },
  pillText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  pillTextDelegated: { color: colors.saffronDeep },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(11,20,17,.45)', flex: 1, justifyContent: 'center' },
  sheet: {
    backgroundColor: colors.canvas,
    borderRadius: radii.lg,
    gap: spacing.xs,
    padding: spacing.lg,
    width: '84%',
  },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  sheetTitle: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: '900' },
  closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  option: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
});
