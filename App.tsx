import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFrameTime, setLastFrameTime] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // The Capture Loop
  useEffect(() => {
    // Only start the loop if we have permission and the device is ready
    if (!hasPermission || device == null) return;

    const intervalId = setInterval(async () => {
      // Prevent taking a new photo if we are still processing the previous one
      if (isProcessing || !camera.current) return;

      try {
        setIsProcessing(true);
        const start = Date.now();

        // Take a photo without shutter sound and flash
        const photo = await camera.current.takePhoto({
          flash: 'off',
        });

        const end = Date.now();
        console.log(`📸 Captured frame in ${end - start}ms at path: ${photo.path}`);
        setLastFrameTime(end - start);
        setFrameCount(prev => prev + 1);

        // TODO: Pass photo.path to OpenCV Native Module here

      } catch (error) {
        console.error('Failed to capture frame:', error);
      } finally {
        setIsProcessing(false);
      }
    }, 1000); // Capture every 1000ms

    return () => clearInterval(intervalId);
  }, [hasPermission, device, isProcessing]);

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
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />

      {/* Dev UI to see performance */}
      <View style={styles.overlay}>
        <Text style={styles.statusText}>Phase 1: Capturing Loop Active</Text>
        <Text style={styles.subText}>
          {frameCount > 0 ? `Captured ${frameCount} frames` : 'Waiting for frame...'}
        </Text>
        <Text style={styles.subText}>
          {lastFrameTime > 0 ? `Last capture: ${lastFrameTime}ms` : ''}
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subText: {
    color: '#00ff00',
    fontSize: 14,
  }
});
