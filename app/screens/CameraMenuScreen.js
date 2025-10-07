import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import NavigatorModule from '../utils/NavigatorModule';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme, createThemedStyles } from '../utils/themeService';

const CameraMenuScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  useEffect(() => {
    const ensureCameraPermission = async () => {
      const result = await check(PERMISSIONS.ANDROID.CAMERA);
      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        const requestResult = await request(PERMISSIONS.ANDROID.CAMERA);
        setHasPermission(requestResult === RESULTS.GRANTED);
      }
    };
    ensureCameraPermission();
  }, []);

  const openCamera = async () => {
    if (!hasPermission) {
      const requestResult = await request(PERMISSIONS.ANDROID.CAMERA);
      if (requestResult !== RESULTS.GRANTED) {
        Alert.alert('Permission required', 'Camera permission is required to use the gesture recognizer.');
        return;
      }
      setHasPermission(true);
    }
    
    try {
      NavigatorModule.openGestureRecognizerActivity();
      setIsCameraOpen(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to open camera: ' + error.message);
    }
  };

  const closeCamera = () => {
    setIsCameraOpen(false);
    // The native activity will handle closing itself
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.name === 'dark' ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      
      <View style={styles.circle} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Camera Menu</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.cameraButtonContainer}>
          <TouchableOpacity
            style={[styles.cameraButton, !hasPermission && styles.disabledButton]}
            onPress={openCamera}
            disabled={!hasPermission}
          >
            <Text style={styles.cameraButtonText}>
              {hasPermission ? 'Open Camera' : 'Camera Permission Required'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Use the camera to perform gestures and see them translated to text in real-time.
          </Text>
        </View>
      </View>

      <BottomNavigation />
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  circle: {
    position: 'absolute',
    bottom: -262.5,
    width: 507,
    height: 525,
    borderRadius: 300,
    backgroundColor: 'rgba(124, 1, 246, 0.64)',
    opacity: 0.21,
    shadowColor: '#7C01F6',
    filter: 'blur(99px)',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 50,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  cameraButtonContainer: {
    marginBottom: 40,
  },
  cameraButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 25,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: theme.colors.buttonSecondary,
  },
  cameraButtonText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoContainer: {
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default CameraMenuScreen;