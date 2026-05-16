import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, NativeModules, Image, ScrollView } from 'react-native';
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
  const [capturedMarkers, setCapturedMarkers] = useState<string[]>([]);
  const [lastExtractionTime, setLastExtractionTime] = useState(0);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // The Capture Loop
  useEffect(() => {
    // Only start the loop if we have permission, device is ready, and we haven't hit 20 markers
    if (!hasPermission || device == null || capturedMarkers.length >= 20) return;

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
                setCapturedMarkers(prev => {
                    if (prev.length >= 20) return prev;
                    return [...prev, extractedImagePath];
                });
                setLastExtractionTime(processEnd - start);
            } else {
                console.warn(`⚠️ Marker ignored! Processing took ${processEnd - start}ms (over 3000ms limit)`);
            }
        } catch (opencvError: any) {
            console.log(`OpenCV Debug: ${opencvError.message}`);
        }

      } catch (error) {
        console.error('Failed to capture frame:', error);
      } finally {
        setIsProcessing(false);
      }
    }, 200); // Check every 200ms (will skip if isProcessing is true)

    return () => clearInterval(intervalId);
  }, [hasPermission, device, isProcessing, capturedMarkers.length]);

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

  const resetScanner = () => {
    setCapturedMarkers([]);
    setFrameCount(0);
    setLastExtractionTime(0);
  };

  return (
    <View style={styles.container}>
      {capturedMarkers.length < 20 ? (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo={true}
        />
      ) : (
        <View style={styles.successScreen}>
            <View style={styles.header}>
                <Text style={styles.successText}>🎉 Goal Reached!</Text>
                <Text style={styles.text}>Successfully extracted 20 markers</Text>
                <Text style={styles.resetButton} onPress={resetScanner}>
                    🔄 Scan Again
                </Text>
            </View>
            <ScrollView contentContainerStyle={styles.gridContainer}>
                {capturedMarkers.map((uri, index) => (
                    <View key={index} style={styles.gridItem}>
                        <Image source={{ uri }} style={styles.gridImage} />
                        <Text style={styles.subText}>Processed Marker #{index + 1}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
      )}

      {/* Dev UI to see performance & progress */}
      {capturedMarkers.length < 20 && (
          <View style={styles.overlay}>
            <Text style={styles.statusText}>Phase 2: OpenCV Active</Text>
            <Text style={styles.goalText}>
                Markers Found: {capturedMarkers.length} / 20
            </Text>
            
            {capturedMarkers.length > 0 && (
                <View style={styles.imageContainer}>
                    <Image source={{ uri: capturedMarkers[capturedMarkers.length - 1] }} style={styles.previewImage} />
                    <Text style={styles.subText}>Extracted in: {lastExtractionTime}ms</Text>
                </View>
            )}

            <Text style={styles.subText}>
              {frameCount > 0 ? `Captured ${frameCount} raw frames` : 'Waiting for frame...'}
            </Text>
          </View>
      )}
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
  successScreen: {
    flex: 1,
    backgroundColor: '#111',
    paddingTop: 60,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resetButton: {
    backgroundColor: '#333',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  text: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    marginBottom: 20,
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
  },
  gridContainer: {
    paddingBottom: 40,
    alignItems: 'center',
    width: '100%',
  },
  gridItem: {
    marginVertical: 15,
    alignItems: 'center',
  },
  gridImage: {
    width: 300,
    height: 300,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#444',
  }
});
