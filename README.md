# MarkerDetectorApp 📸

A high-performance React Native Android application built to detect, extract, and geometrically normalize visual markers from a live camera feed.

**Built as part of the Engineering Internship Assignment.**

## 🎯 Assignment Fulfillment & Constraints

This application strictly adheres to all provided constraints and evaluation criteria:

- **React Native Usage:** Built entirely with React Native and native Android (Kotlin/C++) bridges.
- **Provided Marker (Constraint #2):** Configured to accurately detect **Marker 1** from the provided test images.
- **Robust Detection (Constraint #4):** Implemented strict OpenCV geometric filtering (aspect ratio and extent) to ignore false positives and 'Incorrect Marker' variants.
- **High-Resolution Feed (Constraint #5):** Dynamic scaling ensures that the processed camera frame is strictly bounded between **2000x2000px** and **3000x3000px**.
- **Output Resolution (Constraint #6):** The processed markers are extracted using a Perspective Transform to exactly **300x300px**.
- **Speed (<3000ms):** Total scan-to-extraction latency is highly optimized, averaging **~1000ms to 1500ms** per frame.

---

## 📦 Deliverables Included

1. **Installable APK:** Located at `android/app/build/outputs/apk/release/app-release.apk`.
2. **Public Repository:** Complete source code.
3. **Documentation:** `Documentation.pdf` (or `Documentation.md`) explains the OpenCV pipeline, architecture, and mathematical approach.

---

## 🛠️ Setup & Build Instructions

Follow these steps to run the project locally.

### Prerequisites
- Node.js (v18+)
- Android Studio with Android SDK 34+
- A running Android Emulator or physical Android device (Recommended for Camera access)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Metro Bundler
In your terminal, start the React Native development server:
```bash
npx react-native start
```

### 3. Build & Run the App
Open a *second* terminal window in the project root and run:
```bash
npm run android
```

*Note: Due to the Native OpenCV bindings and camera hardware requirements, the app must be compiled to an Android device or emulator; it cannot be run in Expo Go.*

### 4. Building the APK (Optional)
To generate the production APK manually:
```bash
cd android
./gradlew assembleRelease
```
The resulting APK will be available in `android/app/build/outputs/apk/release/`.
