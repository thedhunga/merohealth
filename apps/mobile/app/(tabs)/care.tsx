import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { BadgeCheck, Building2, Home, MapPin, Search } from 'lucide-react-native';
import { searchDirectory } from '@swasthya/care-directory';
import type { DirectoryEntityType } from '@swasthya/shared-types';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Pill, Screen, SectionTitle } from '@/components/ui';
import { useAppState } from '@/state/app-state';
const filters: { type?: DirectoryEntityType; labelNe: string; labelEn: string }[] = [
  { labelNe: 'सबै', labelEn: 'All' },
  { type: 'HOSPITAL', labelNe: 'अस्पताल', labelEn: 'Hospital' },
  { type: 'SPECIALIST', labelNe: 'विशेषज्ञ', labelEn: 'Specialist' },
  { type: 'PHARMACY', labelNe: 'फार्मेसी', labelEn: 'Pharmacy' },
  { type: 'LABORATORY', labelNe: 'ल्याब', labelEn: 'Laboratory' },
  { type: 'HOME_NURSE', labelNe: 'घरमै नर्स', labelEn: 'Home nurse' },
];
export default function CareScreen() {
  const { language } = useAppState();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [text, setText] = useState('');
  const [type, setType] = useState<DirectoryEntityType | undefined>();
  const results = useMemo(
    () => searchDirectory({ ...(text ? { text } : {}), ...(type ? { type } : {}) }),
    [text, type],
  );
  return (
    <Screen>
      <SectionTitle
        eyebrow="VERIFIED CARE NETWORK"
        title={language === 'en' ? 'Find the right service' : 'सही सेवा खोज्नुहोस्'}
        body={
          language === 'en'
            ? "From hospitals to home nursing. Every listing's source and freshness is shown clearly."
            : 'अस्पतालदेखि घरमै नर्सिङसम्म। हरेक विवरणको स्रोत र ताजापन स्पष्ट देखाइन्छ।'
        }
      />
      <View style={styles.search}>
        <Search color={colors.muted} size={20} />
        <TextInput
          accessibilityLabel={language === 'en' ? 'Search care directory' : 'सेवा निर्देशिका खोज्नुहोस्'}
          value={text}
          onChangeText={setText}
          placeholder={language === 'en' ? 'Name, specialty or district…' : 'नाम, विशेषज्ञता वा जिल्ला…'}
          placeholderTextColor="#82918E"
          style={styles.searchInput}
        />
      </View>
      <View style={styles.filters}>
        {filters.map((filter) => (
          <Pill
            key={filter.labelEn}
            label={language === 'en' ? filter.labelEn : filter.labelNe}
            selected={type === filter.type}
            onPress={() => setType(filter.type)}
          />
        ))}
      </View>
      <View style={styles.demo}>
        <Text style={styles.demoTitle}>
          {language === 'en' ? 'Fictional demonstration listing' : 'काल्पनिक प्रदर्शन विवरण'}
        </Text>
        <Text style={styles.demoBody}>
          {language === 'en'
            ? "The national registry isn't connected yet. The organisations and individuals below are not real service providers."
            : 'राष्ट्रिय सूची अझै जोडिएको छैन। तलका संस्था र व्यक्ति वास्तविक सेवा प्रदायक होइनन्।'}
        </Text>
      </View>
      <View style={[styles.results, wide && styles.resultsWide]}>
        {results.map((entity) => (
          <View key={entity.id} style={[styles.card, wide && styles.cardWide]}>
            <View style={styles.cardTop}>
              <View style={styles.icon}>
                {entity.supportsHomeService ? (
                  <Home color={colors.primary} />
                ) : (
                  <Building2 color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{entity.nameNe}</Text>
                <Text style={styles.nameEn}>{entity.name}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <MapPin color={colors.muted} size={15} />
              <Text style={styles.meta}>
                {entity.municipality}, {entity.district}
              </Text>
            </View>
            <View style={styles.tags}>
              {entity.specialties.slice(0, 2).map((item) => (
                <Text key={item} style={styles.tag}>
                  {item}
                </Text>
              ))}
            </View>
            <View style={styles.verify}>
              <BadgeCheck color={colors.primary} size={17} />
              <Text style={styles.meta}>
                {entity.verification === 'VERIFIED'
                  ? language === 'en'
                    ? 'Demo verified'
                    : 'डेमो प्रमाणित'
                  : language === 'en'
                    ? 'Reviewed'
                    : 'समीक्षा गरिएको'}{' '}
                · {new Date(entity.dataAsOf).toLocaleDateString(language === 'en' ? 'en-US' : 'ne-NP')}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  search: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { color: colors.ink, flex: 1, fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  demo: { backgroundColor: colors.saffronSoft, borderRadius: radii.md, padding: spacing.md },
  demoTitle: { color: colors.saffronDeep, fontSize: 12, fontWeight: '900' },
  demoBody: { color: colors.saffronDeep, fontSize: 11, lineHeight: 17, marginTop: 4 },
  results: { gap: spacing.md },
  resultsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  cardWide: { width: '48.8%' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  name: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  nameEn: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', gap: spacing.sm },
  meta: { color: colors.muted, fontSize: 11 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.canvas,
    borderRadius: radii.pill,
    color: colors.ink,
    fontSize: 11,
    padding: spacing.sm,
  },
  verify: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
