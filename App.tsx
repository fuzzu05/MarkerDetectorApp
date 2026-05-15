import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, NativeModules, Image } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

const { MarkerDetector } = NativeModules;

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFrameTime, setLastFrameTime] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  
  // Phase 2 Tracker State
  const [markersFound, setMarkersFound] = useState(0);
  const [latestMarkerImage, setLatestMarkerImage] = useState<string | null>(null);
  const [lastExtractionTime, setLastExtractionTime] = useState(0);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // The Capture Loop
  useEffect(() => {
    // Only start the loop if we have permission, device is ready, and we haven't hit 20 markers
    if (!hasPermission || device == null || markersFound >= 20) return;

    const intervalId = setInterval(async () => {
      // Prevent taking a new photo if we are still processing the previous one
      if (isProcessing || !camera.current) return;

      try {
        setIsProcessing(true);
        const start = Date.now();

        // 1. Take a high-res photo without shutter sound and flash
        const photo = await camera.current.takePhoto({
          flash: 'off',
        });

        const captureEnd = Date.now();
        console.log(`📸 Captured frame in ${captureEnd - start}ms at path: ${photo.path}`);
        setLastFrameTime(captureEnd - start);
        setFrameCount(prev => prev + 1);

        // 2. Pass photo.path to OpenCV Native Module
        try {
            const extractedImagePath = await MarkerDetector.processMarker(photo.path);
            const processEnd = Date.now();
            
            console.log(`✅ Marker Extracted in ${processEnd - captureEnd}ms: ${extractedImagePath}`);
            
            // Validate the latency goal: must be < 3000ms!
            if (processEnd - start < 3000) {
                setMarkersFound(prev => Math.min(prev + 1, 20));
                setLatestMarkerImage(extractedImagePath);
                setLastExtractionTime(processEnd - start);
            } else {
                console.warn(`⚠️ Marker ignored! Processing took ${processEnd - start}ms (over 3000ms limit)`);
            }
        } catch (opencvError: any) {
            // Temporarily logging this so we can debug why nothing is working!
            console.log(`OpenCV Debug: ${opencvError.message}`);
        }

      } catch (error) {
        console.error('Failed to capture frame:', error);
      } finally {
        setIsProcessing(false);
      }
    }, 1000); // Capture every 1000ms

    return () => clearInterval(intervalId);
  }, [hasPermission, device, isProcessing, markersFound]);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.text}>Requesting Camera Permission...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>No camera device found!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {markersFound < 20 ? (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo={true}
        />
      ) : (
        <View style={styles.centered}>
            <Text style={styles.successText}>🎉 Goal Reached!</Text>
            <Text style={styles.text}>Successfully extracted 20 markers</Text>
        </View>
      )}

      {/* Dev UI to see performance & progress */}
      <View style={styles.overlay}>
        <Text style={styles.statusText}>
            {markersFound >= 20 ? 'Goal Completed!' : 'Phase 2: OpenCV Active'}
        </Text>
        <Text style={styles.goalText}>
            Markers Found: {markersFound} / 20
        </Text>
        
        {latestMarkerImage && (
            <View style={styles.imageContainer}>
                <Image source={{ uri: latestMarkerImage }} style={styles.previewImage} />
                <Text style={styles.subText}>Extracted in: {lastExtractionTime}ms</Text>
            </View>
        )}

        <Text style={styles.subText}>
          {frameCount > 0 ? `Captured ${frameCount} raw frames` : 'Waiting for frame...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    width: '80%',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  goalText: {
    color: '#00ff00',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 15,
  },
  subText: {
    color: '#aaaaaa',
    fontSize: 12,
    marginTop: 5,
  },
  successText: {
    color: '#00ff00',
    fontSize: 32,
    fontWeight: 'bold',
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#222',
    borderRadius: 10,
  },
  previewImage: {
    width: 140,
    height: 140,
    borderRadius: 5,
    marginBottom: 5,
  }
});
