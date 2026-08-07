import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Captions,
  Camera,
  CameraOff,
  LockKeyhole,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react-native';
import { colors, radii, spacing } from '@swasthya/configuration';

export default function ConsultationPreviewScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [started]);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [elapsed]);

  const enableCamera = async () => {
    if (permission?.granted) {
      setCameraOn((current) => !current);
      return;
    }
    const result = await requestPermission();
    if (result.granted) setCameraOn(true);
  };

  const endPreview = () => {
    setStarted(false);
    setCameraOn(false);
    router.back();
  };

  return (
    <LinearGradient colors={['#071F25', '#0B3136', '#112B42']} style={styles.background}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
            <ArrowLeft color="white" size={21} />
          </Pressable>
          <View style={styles.roomMeta}>
            <Text style={styles.roomEyebrow}>PRIVATE VIDEO ROOM · PREVIEW</Text>
            <Text style={styles.roomTitle}>Consultation experience</Text>
          </View>
          <View style={styles.secure}>
            <LockKeyhole color="#8CE3CF" size={15} />
            <Text style={styles.secureText}>No call is connected</Text>
          </View>
        </View>

        <View style={[styles.stage, wide && styles.stageWide]}>
          <View style={styles.remoteTile}>
            <LinearGradient colors={['#164B4A', '#183856']} style={styles.remoteGradient}>
              <View style={styles.constellationOne} />
              <View style={styles.constellationTwo} />
              <View style={styles.clinicianAvatar}>
                <Stethoscope color="#083F3B" size={46} strokeWidth={1.7} />
              </View>
              <Text style={styles.remoteKicker}>CLINICIAN PARTICIPANT</Text>
              <Text style={styles.remoteTitle}>A verified professional would appear here.</Text>
              <Text style={styles.remoteBody}>
                This preview demonstrates the room controls only. It does not create a public link,
                contact a clinician, or transmit health information.
              </Text>
              <View style={styles.waitingChip}>
                <Users color="#B9ECDF" size={16} />
                <Text style={styles.waitingText}>
                  {started ? 'Preview session active' : 'Ready when you are'}
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View style={[styles.localTile, !wide && styles.localTileNarrow]}>
            {cameraOn && permission?.granted ? (
              <CameraView active={cameraOn} facing="front" mirror style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient colors={['#DFF4ED', '#B7DCD5']} style={styles.cameraPlaceholder}>
                <View style={styles.cameraIcon}>
                  <CameraOff color={colors.primaryDark} size={30} />
                </View>
                <Text style={styles.cameraTitle}>Your camera is off</Text>
                <Text style={styles.cameraBody}>Preview stays on this device.</Text>
              </LinearGradient>
            )}
            <View style={styles.youBadge}>
              <Text style={styles.youText}>YOU · LOCAL PREVIEW</Text>
            </View>
          </View>
        </View>

        {captionsOn ? (
          <View accessibilityLiveRegion="polite" style={styles.captionBar}>
            <Captions color="#8CE3CF" size={18} />
            <Text style={styles.captionText}>
              Live captions will appear here when a secure video provider is configured.
            </Text>
          </View>
        ) : null}

        <View style={styles.statusRow}>
          <View style={styles.safetyStatus}>
            <ShieldCheck color="#8CE3CF" size={18} />
            <Text style={styles.safetyText}>Consent and participant authorization required</Text>
          </View>
          <Text style={styles.timer}>{started ? timerLabel : 'PREVIEW'}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityLabel={microphoneOn ? 'Mute microphone' : 'Unmute microphone'}
            onPress={() => setMicrophoneOn((current) => !current)}
            style={[styles.control, !microphoneOn && styles.controlOff]}
          >
            {microphoneOn ? <Mic color="white" size={21} /> : <MicOff color="white" size={21} />}
          </Pressable>

          <Pressable
            accessibilityLabel={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            onPress={() => {
              void enableCamera();
            }}
            style={[styles.control, !cameraOn && styles.controlOff]}
          >
            {cameraOn ? <Camera color="white" size={21} /> : <CameraOff color="white" size={21} />}
          </Pressable>

          <Pressable
            accessibilityLabel={captionsOn ? 'Turn captions off' : 'Turn captions on'}
            onPress={() => setCaptionsOn((current) => !current)}
            style={[styles.control, captionsOn && styles.controlSelected]}
          >
            <Captions color="white" size={21} />
          </Pressable>

          {!started ? (
            <Pressable onPress={() => setStarted(true)} style={styles.startButton}>
              <Camera color="#083F3B" size={20} />
              <Text style={styles.startText}>Start private preview</Text>
            </Pressable>
          ) : (
            <Pressable onPress={endPreview} style={styles.endButton}>
              <PhoneOff color="white" size={21} />
              <Text style={styles.endText}>End</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.disclaimer}>
          Demonstration room · No clinician, recording, signaling server, or WebRTC provider is
          connected
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  page: { flexGrow: 1, minHeight: '100%', padding: spacing.lg },
  topbar: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    maxWidth: 1200,
    paddingBottom: spacing.lg,
    width: '100%',
  },
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.1)',
    borderColor: 'rgba(255,255,255,.13)',
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  roomMeta: { flex: 1 },
  roomEyebrow: { color: '#8BCDC0', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  roomTitle: { color: 'white', fontSize: 19, fontWeight: '900', marginTop: 3 },
  secure: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,39,42,.7)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secureText: { color: '#D9F3EC', fontSize: 10, fontWeight: '800' },
  stage: { alignSelf: 'center', flex: 1, gap: spacing.md, maxWidth: 1200, width: '100%' },
  stageWide: { flexDirection: 'row' },
  remoteTile: { borderRadius: 28, flex: 1.7, minHeight: 430, overflow: 'hidden' },
  remoteGradient: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.xl,
    position: 'relative',
  },
  constellationOne: {
    borderColor: 'rgba(174,232,218,.12)',
    borderRadius: 200,
    borderWidth: 1,
    height: 400,
    position: 'absolute',
    right: -90,
    top: -150,
    width: 400,
  },
  constellationTwo: {
    borderColor: 'rgba(255,223,161,.1)',
    borderRadius: 150,
    borderWidth: 1,
    bottom: -130,
    height: 300,
    left: -100,
    position: 'absolute',
    width: 300,
  },
  clinicianAvatar: {
    alignItems: 'center',
    backgroundColor: '#C7EFE4',
    borderColor: 'rgba(255,255,255,.8)',
    borderRadius: 48,
    borderWidth: 5,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  remoteKicker: {
    color: '#8ED8C7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 24,
  },
  remoteTitle: {
    color: 'white',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 10,
    maxWidth: 500,
    textAlign: 'center',
  },
  remoteBody: {
    color: '#CAE1DF',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 520,
    textAlign: 'center',
  },
  waitingChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,38,40,.68)',
    borderColor: 'rgba(185,236,223,.18)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  waitingText: { color: '#DDF6EF', fontSize: 10, fontWeight: '800' },
  localTile: {
    backgroundColor: '#DFF4ED',
    borderColor: 'rgba(255,255,255,.15)',
    borderRadius: 28,
    borderWidth: 1,
    flex: 0.8,
    minHeight: 430,
    overflow: 'hidden',
    position: 'relative',
  },
  localTileNarrow: { minHeight: 270 },
  cameraPlaceholder: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  cameraIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.72)',
    borderRadius: 27,
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  cameraTitle: { color: '#123C39', fontSize: 17, fontWeight: '900', marginTop: 16 },
  cameraBody: { color: '#5B7470', fontSize: 11, marginTop: 5 },
  youBadge: {
    backgroundColor: 'rgba(5,33,36,.78)',
    borderRadius: 999,
    bottom: 14,
    left: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
  },
  youText: { color: 'white', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  captionBar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(4,27,30,.9)',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    maxWidth: 760,
    padding: spacing.md,
    width: '100%',
  },
  captionText: { color: 'white', flex: 1, fontSize: 12, textAlign: 'center' },
  statusRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 1200,
    paddingTop: spacing.md,
    width: '100%',
  },
  safetyStatus: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  safetyText: { color: '#B9D7D3', fontSize: 10, fontWeight: '700' },
  timer: { color: '#B9D7D3', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  controls: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: spacing.lg,
    maxWidth: 900,
  },
  control: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.15)',
    borderColor: 'rgba(255,255,255,.14)',
    borderRadius: 20,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  controlOff: { backgroundColor: '#4D5960' },
  controlSelected: { backgroundColor: '#0A7B6D' },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#BFEBDD',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  startText: { color: '#083F3B', fontSize: 12, fontWeight: '900' },
  endButton: {
    alignItems: 'center',
    backgroundColor: '#D4483F',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 19,
  },
  endText: { color: 'white', fontSize: 12, fontWeight: '900' },
  disclaimer: { color: '#7EA09E', fontSize: 9, marginTop: spacing.md, textAlign: 'center' },
});
