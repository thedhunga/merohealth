import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { optionalPurposes } from '@swasthya/language-corpus';
import type { ConsentPurpose } from '@swasthya/language-corpus';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Screen } from '@/components/ui';
import { useAppState } from '@/state/app-state';

/**
 * language-corpus.md §3: each purpose is separate and independently
 * revocable, defaults off, and must never ride along on terms-of-service
 * acceptance — so this screen is the *only* place any of these three
 * purposes can be turned on, reached deliberately rather than folded into
 * onboarding. Order follows `optionalPurposes` itself, not a hand-picked
 * list, so a future purpose added to the package appears here without this
 * file changing.
 */
type OptionalPurpose = Exclude<ConsentPurpose, 'SERVICE_DELIVERY'>;

// `optionalPurposes` is typed as `readonly ConsentPurpose[]` at its source —
// it excludes SERVICE_DELIVERY by construction, not by type, so this filter
// narrows it back to `OptionalPurpose` for a type-checked `COPY` lookup below.
const isOptionalPurpose = (purpose: ConsentPurpose): purpose is OptionalPurpose => purpose !== 'SERVICE_DELIVERY';

const COPY: Record<OptionalPurpose, { titleNe: string; titleEn: string; bodyNe: string; bodyEn: string }> = {
  MODEL_TRAINING_TEXT: {
    titleNe: 'लेखिएको कुरा — नेपाली सहायक सुधार्न',
    titleEn: 'Written messages — to improve the Nepali assistant',
    bodyNe:
      'तपाईंले लेख्नुभएका सन्देश, फोन नम्बर र इमेल जस्ता स्पष्ट चिनारी स्वतः हटाइसकेपछि, नेपाली स्वास्थ्य सहायक तालिम दिन प्रयोग हुन सक्छ। नाम वा ठेगाना जस्ता कुरा बाँकी रहन सक्ने भएकाले, चिनारी देखिन सक्ने जुनसुकै सन्देश प्रयोग हुनुअघि मानिसले जाँच्छ।',
    bodyEn:
      'Messages you write, after clear identifiers like phone numbers and emails are automatically removed, may be used to train the Nepali health assistant. Because things like names or places can still remain, anything that might identify you is checked by a person before it is used.',
  },
  MODEL_TRAINING_VOICE: {
    titleNe: 'आवाज — छुट्टै अनुमति',
    titleEn: 'Voice — a separate permission',
    bodyNe:
      'माथिकै उद्देश्यका लागि हो, तर आवाजबाट लेखमा उतारिएको पाठ प्रयोग हुन्छ, नबोलेको आवाज होइन। आवाजले चाँडै चिनारी दिन सक्ने भएकाले, हरेक आवाज-नमूना प्रयोग हुनुअघि सधैं मानिसले जाँच्छ — लेखिएको कुरामा जस्तो कहिलेकाहीं होइन।',
    bodyEn:
      'The same purpose as written messages, but for the text transcribed from your voice, not the recording itself. Because voice is more identifying, every voice sample is always checked by a person before use — not only sometimes, the way written messages are.',
  },
  HUMAN_REVIEW: {
    titleNe: 'मानव समीक्षा',
    titleEn: 'Human review',
    bodyNe:
      'मेरो स्वास्थ्यको कोही व्यक्तिले, चिनारी हटाइसकेको तपाईंको कुराकानी हेर्न सक्छ — गुणस्तर जाँच्न वा माथिका उद्देश्यमा प्रयोग हुनुअघि। यो नखोलेमा, चिनारी देखिन सक्ने कुनै पनि सन्देश प्रयोग हुँदैन।',
    bodyEn:
      'Someone at Mero Health may read your de-identified conversation — to check quality, or before it is used for the purposes above. If this is off, anything that might identify you is never used.',
  },
};

export default function ConsentScreen() {
  const { language, hasConsent, setConsent } = useAppState();
  const isEnglish = language === 'en';

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEnglish ? 'Go back' : 'पछाडि जानुहोस्'}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEnglish ? 'Data consent' : 'तथ्याङ्क सहमति'}</Text>
      </View>

      <View style={styles.guide}>
        <ShieldCheck color={colors.primary} size={21} />
        <Text style={styles.guideText}>
          {isEnglish
            ? 'Every purpose below is off by default and separate from the others — turning one on never turns on another. None of this is part of accepting any terms, and the app works the same either way.'
            : 'तलका हरेक उद्देश्य पूर्वनिर्धारित रूपमा बन्द छन् र एक-अर्कासँग जोडिएका छैनन् — एउटा खोल्दा अर्को खुल्दैन। यो कुनै सर्त स्वीकृतिको हिस्सा होइन, र नखोले पनि एप उस्तै चल्छ।'}
        </Text>
      </View>

      {optionalPurposes.filter(isOptionalPurpose).map((purpose) => {
        const copy = COPY[purpose];
        const enabled = hasConsent(purpose);
        return (
          <View key={purpose} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{isEnglish ? copy.titleEn : copy.titleNe}</Text>
              <Switch
                accessibilityLabel={isEnglish ? copy.titleEn : copy.titleNe}
                onValueChange={(value) => setConsent(purpose, value)}
                thumbColor="white"
                trackColor={{ false: colors.line, true: colors.primary }}
                value={enabled}
              />
            </View>
            <Text style={styles.cardBody}>{isEnglish ? copy.bodyEn : copy.bodyNe}</Text>
          </View>
        );
      })}
    </Screen>
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
  guide: {
    alignItems: 'flex-start',
    backgroundColor: colors.mint,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  guideText: { color: colors.primaryDark, flex: 1, fontSize: 13, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: '900' },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
