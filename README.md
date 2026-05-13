# MarkerDetectorApp 📸

A high-performance React Native Android application built to detect, extract, and process custom visual markers from a live camera feed. 

The primary goal of this application is to capture high-resolution imagery (2000x2000px+) and perform perspective correction and extraction using native OpenCV within a strict **<3000ms** latency threshold.

## 🚀 Development Strategy & Phases

To ensure maximum stability and performance, the development of this application is broken down into structured phases. We are prioritizing a "Fastest Path" approach: offloading heavy image processing entirely to Native Android (Kotlin + OpenCV) rather than doing it in JavaScript.

### ✅ Phase 1: Camera Setup & Capture Loop (Completed)
- **Framework Setup**: Initialized the React Native Android environment (`v0.85.3`).
- **Camera Integration**: Integrated `react-native-vision-camera`. 
  - *Note on Architecture*: We intentionally downgraded to the highly stable `v4.6.0` release and disabled C++ `Frame Processors` in `gradle.properties`. This completely bypasses severe Windows CMake/Ninja compiler loops associated with the bleeding-edge v5 "Nitro" modules, ensuring a rock-solid Windows development environment.
- **Capture Loop**: Engineered a background `setInterval` loop that silently captures a high-resolution frame from the camera every 1000ms and logs the temporary disk path (latency: ~300-400ms).

### 🚧 Phase 2: Native OpenCV Extraction (Upcoming)
- **Native Module Setup**: Create a Custom Kotlin module bridging React Native and OpenCV.
- **Contour Detection**: Convert frames to grayscale, apply Gaussian blur, and use Canny edge detection to find the 4-point quadrilateral marker.
- **Perspective Warp**: Flatten and warp the distorted marker into a perfect 2D square.
- **Orientation Check**: Detect the prominent black square in the top-left corner to ensure the marker is upright.

---

## 🛠️ Setup Instructions

Follow these steps to run the project locally if you have just pulled it from GitHub:

### Prerequisites
- Node.js (v18+)
- Android Studio with Android SDK 34+
- A running Android Emulator (or a physical Android device connected via USB)

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

### 💡 Troubleshooting
If you encounter `EADDRINUSE` or the app hangs with an "App isn't responding" (ANR) error on the emulator, it means a background process is locking the port or files. 
1. Stop the Metro server (`Ctrl + C`).
2. Run `.\android\gradlew --stop` to kill the background Java daemon.
3. If necessary, kill background Node processes: `Stop-Process -Name "node" -Force` (Powershell) or `killall node` (Mac/Linux).
4. Run `npm run android` again.

---
*Built as part of an Engineering Internship Assignment.*
