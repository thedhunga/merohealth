# ADR-001: Expo React Native mobile platform

Status: accepted for MVP · 2026-08-06

Use Expo SDK 57 with React Native 0.86 for one Android/iOS codebase. The alternative of separate SwiftUI and Kotlin applications offers maximum native control but doubles early product and safety validation effort. Expo development builds preserve native escape hatches and EAS/local native projects can be adopted when integrations require them.

Motion uses a small semantic vocabulary—enter, reveal, confirm, redirect, and celebrate—implemented with Reanimated and system reduced-motion settings. Decorative ambient motion stops in low-bandwidth, battery-saving, or reduced-motion modes. No animation delays emergency actions or obscures consent.

Training media is not embedded as large binaries in the app. A signed media manifest selects captioned adaptive streams, downloadable low-bandwidth renditions, poster art, and transcripts. The initial repository provides the player/manifest contract and human-authored scripts; production video assets require content production and review.

