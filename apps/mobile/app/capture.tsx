import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  AlertTriangle,
  ArrowLeft,
  Camera as CameraIcon,
  Check,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react-native';
import type { HealthDocumentKind } from '@swasthya/shared-types';
import { colors, radii, spacing } from '@swasthya/configuration';
import { Pill, uiStyles } from '@/components/ui';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { useAppState } from '@/state/app-state';
import { documentKindOptions } from '@/lib/document-kinds';
import { capturePhoto } from '@/lib/capture-photo';
import { RecordsApiError, captureDocument } from '@/lib/records-api';

type Step = 'camera' | 'review' | 'done';

interface CapturedPhoto {
  uri: string;
  base64: string;
}

export default function CaptureScreen() {
  const { language, actingSubjects, activeSubject, switchActingSubject } = useAppState();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [step, setStep] = useState<Step>('camera');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [kind, setKind] = useState<HealthDocumentKind>('LAB_REPORT');
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const takePhoto = async () => {
    // Android rejects a `takePictureAsync` issued while another is still in
    // flight, so an impatient double-tap was itself one of the ways the
    // shutter used to die.
    if (isCapturing) return;
    setIsCapturing(true);
    setCameraError(null);
    const outcome = await capturePhoto(() =>
      cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5 }),
    );
    setIsCapturing(false);
    if (outcome.status === 'failed') {
      setCameraError(
        language === 'en'
          ? 'Could not take the photo. Try again.'
          : 'फोटो खिच्न सकिएन। फेरि प्रयास गर्नुहोस्।',
      );
      return;
    }
    setPhoto({ uri: outcome.uri, base64: outcome.base64 });
    setStep('review');
  };

  const allowCamera = async () => {
    setCameraError(null);
    try {
      await requestPermission();
    } catch {
      setCameraError(
        language === 'en'
          ? 'Could not open the camera. Check this device’s camera permission and try again.'
          : 'क्यामेरा खोल्न सकिएन। उपकरणको क्यामेरा अनुमति जाँच गरेर फेरि प्रयास गर्नुहोस्।',
      );
    }
  };

  const retake = () => {
    setPhoto(null);
    setUploadError(null);
    setCameraError(null);
    setStep('camera');
  };

  const upload = async () => {
    if (!photo || !title.trim()) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const document = await captureDocument({
        filename: `capture-${Date.now()}.jpg`,
        kind,
        title: title.trim(),
        contentType: 'image/jpeg',
        bytesBase64: photo.base64,
      });
      setSavedTitle(document.title);
      setStep('done');
    } catch (error) {
      if (error instanceof RecordsApiError && error.code === 'QUOTA_EXCEEDED') {
        setUploadError(
          language === 'en'
            ? 'You have reached your document limit on this plan.'
            : 'यो योजनामा कागजात सीमा पुगिसक्यो।',
        );
      } else if (error instanceof RecordsApiError) {
        setUploadError(error.message);
      } else {
        setUploadError(
          language === 'en'
            ? 'Upload failed. Check your connection and try again.'
            : 'अपलोड असफल भयो। नेटवर्क जाँच गरेर पुनः प्रयास गर्नुहोस्।',
        );
      }
    } finally {
      setIsUploading(false);
    }
  };

  const startOver = () => {
    setPhoto(null);
    setTitle('');
    setKind('LAB_REPORT');
    setUploadError(null);
    setCameraError(null);
    setSavedTitle(null);
    setStep('camera');
  };

  if (step === 'done') {
    return (
      <View style={styles.doneScreen}>
        <View style={styles.doneIcon}>
          <Check color="white" size={34} />
        </View>
        <Text style={styles.doneTitle}>{language === 'en' ? 'Document added' : 'कागजात थपियो'}</Text>
        <Text style={styles.doneBody}>{savedTitle}</Text>
        <Pressable onPress={() => router.replace('/records')} style={uiStyles.primaryButton}>
          <Text style={uiStyles.primaryButtonText}>
            {language === 'en' ? 'View my documents' : 'मेरा कागजातहरू हेर्नुहोस्'}
          </Text>
        </Pressable>
        <Pressable onPress={startOver} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>
            {language === 'en' ? 'Add another' : 'अर्को थप्नुहोस्'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'review' && photo) {
    const disableUpload = !title.trim() || isUploading;
    return (
      <ScrollView contentContainerStyle={styles.reviewPage}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={language === 'en' ? 'Retake' : 'फेरि खिच्नुहोस्'}
            onPress={retake}
            style={styles.back}
          >
            <ArrowLeft color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {language === 'en' ? 'Review document' : 'कागजात जाँच्नुहोस्'}
          </Text>
        </View>

        <ProfileSwitcher
          active={activeSubject}
          language={language}
          onSwitch={switchActingSubject}
          subjects={actingSubjects}
        />

        <Image resizeMode="cover" source={{ uri: photo.uri }} style={styles.preview} />

        <Pressable onPress={retake} style={styles.retake}>
          <RotateCcw color={colors.primaryDark} size={16} />
          <Text style={styles.retakeText}>{language === 'en' ? 'Retake photo' : 'फेरि खिच्नुहोस्'}</Text>
        </Pressable>

        <Text style={styles.label}>{language === 'en' ? 'Document type' : 'कागजातको प्रकार'}</Text>
        <View style={styles.pillRow}>
          {documentKindOptions(language).map((option) => (
            <Pill
              key={option.kind}
              label={option.label}
              onPress={() => setKind(option.kind)}
              selected={option.kind === kind}
            />
          ))}
        </View>

        <Text style={styles.label}>{language === 'en' ? 'Title' : 'शीर्षक'}</Text>
        <TextInput
          accessibilityLabel={language === 'en' ? 'Document title' : 'कागजातको शीर्षक'}
          onChangeText={setTitle}
          placeholder={language === 'en' ? 'e.g. Blood panel, March 2026' : 'जस्तै: रगत जाँच, चैत्र २०८२'}
          placeholderTextColor="#82918E"
          style={styles.input}
          value={title}
        />

        {uploadError ? (
          <View style={styles.errorBanner}>
            <AlertTriangle color={colors.danger} size={18} />
            <Text style={styles.errorText}>{uploadError}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={disableUpload}
          onPress={() => void upload()}
          style={[uiStyles.primaryButton, disableUpload && styles.disabled]}
        >
          {isUploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={uiStyles.primaryButtonText}>
              {language === 'en' ? 'Add to my record' : 'मेरो विवरणमा थप्नुहोस्'}
            </Text>
          )}
        </Pressable>

        <View style={styles.privacy}>
          <ShieldCheck color={colors.primary} size={16} />
          <Text style={styles.privacyText}>
            {language === 'en'
              ? 'Only you can see this until you choose to share it.'
              : 'तपाईंले साझा नगरेसम्म यो कागजात तपाईंले मात्र देख्नुहुन्छ।'}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.cameraPage}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={language === 'en' ? 'Go back' : 'पछाडि जानुहोस्'}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft color="white" />
        </Pressable>
        <Text style={styles.headerTitleLight}>
          {language === 'en' ? 'Photograph a document' : 'कागजातको फोटो खिच्नुहोस्'}
        </Text>
      </View>

      {permission?.granted ? (
        <CameraView facing="back" ref={cameraRef} style={styles.camera} />
      ) : (
        <View style={styles.permissionCard}>
          <CameraIcon color={colors.primary} size={32} />
          <Text style={styles.permissionTitle}>
            {language === 'en' ? 'Camera access needed' : 'क्यामेरा अनुमति चाहिन्छ'}
          </Text>
          <Text style={styles.permissionBody}>
            {language === 'en'
              ? 'Mero Health only uses the camera to photograph the document you choose.'
              : 'साथीले तपाईंले रोज्नुभएको कागजात मात्र खिच्न क्यामेरा प्रयोग गर्छ।'}
          </Text>
          <Pressable onPress={() => void allowCamera()} style={uiStyles.primaryButton}>
            <Text style={uiStyles.primaryButtonText}>
              {language === 'en' ? 'Allow camera' : 'क्यामेरा अनुमति दिनुहोस्'}
            </Text>
          </Pressable>
        </View>
      )}

      {cameraError ? (
        <View style={styles.cameraErrorBanner}>
          <AlertTriangle color={colors.danger} size={18} />
          <Text style={styles.errorText}>{cameraError}</Text>
        </View>
      ) : null}

      {permission?.granted ? (
        <View style={styles.shutterRow}>
          <Pressable
            accessibilityLabel={language === 'en' ? 'Take photo' : 'फोटो खिच्नुहोस्'}
            disabled={isCapturing}
            onPress={() => void takePhoto()}
            style={[styles.shutter, isCapturing && styles.disabled]}
          >
            {isCapturing ? <ActivityIndicator color="white" /> : <View style={styles.shutterInner} />}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraPage: { backgroundColor: colors.primaryDark, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.14)',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerTitle: { color: colors.ink, flex: 1, fontSize: 17, fontWeight: '900' },
  headerTitleLight: { color: 'white', flex: 1, fontSize: 17, fontWeight: '900' },
  camera: { flex: 1, marginHorizontal: spacing.lg, borderRadius: radii.lg, overflow: 'hidden' },
  permissionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
  },
  permissionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  permissionBody: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  shutterRow: { alignItems: 'center', padding: spacing.xl },
  shutter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.18)',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  shutterInner: { backgroundColor: 'white', borderRadius: 30, height: 60, width: 60 },
  reviewPage: {
    backgroundColor: colors.canvas,
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  preview: {
    backgroundColor: colors.mint,
    borderRadius: radii.lg,
    height: 320,
    width: '100%',
  },
  retake: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  retakeText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  label: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: spacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, flex: 1, fontSize: 13, lineHeight: 19 },
  // Same banner as the review step's, inset to clear the full-bleed camera
  // ground it sits on rather than the padded scroll page.
  cameraErrorBanner: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  disabled: { opacity: 0.38 },
  privacy: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  privacyText: { color: colors.muted, flex: 1, fontSize: 11, lineHeight: 16 },
  doneScreen: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  doneIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  doneTitle: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  doneBody: { color: colors.muted, fontSize: 14, marginBottom: spacing.md, textAlign: 'center' },
  secondaryButton: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  secondaryButtonText: { color: colors.muted, fontWeight: '800' },
});
