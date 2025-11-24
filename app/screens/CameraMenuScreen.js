import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Modal,
  Linking,
  Dimensions,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import NavigatorModule from '../utils/NavigatorModule';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme, createThemedStyles } from '../utils/themeService';

const CameraMenuScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  useEffect(() => {
    const checkCameraPermission = async () => {
      const result = await check(PERMISSIONS.ANDROID.CAMERA);
      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else {
        setHasPermission(false);
      }
    };
    checkCameraPermission();
  }, []);

  const openCamera = async () => {
    if (!hasPermission) {
      // Check current permission status
      const checkResult = await check(PERMISSIONS.ANDROID.CAMERA);
      
      if (checkResult === RESULTS.BLOCKED) {
        // Permission permanently denied - show modal to go to settings
        setShowPermissionModal(true);
        return;
      }
      
      // Request permission
      const requestResult = await request(PERMISSIONS.ANDROID.CAMERA);
      
      if (requestResult === RESULTS.BLOCKED) {
        // User denied twice - permission permanently blocked
        setShowPermissionModal(true);
        return;
      }
      
      if (requestResult !== RESULTS.GRANTED) {
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

  const handleOpenSettings = () => {
    setShowPermissionModal(false);
    openSettings();
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
            style={styles.cameraButton}
            onPress={openCamera}
          >
            <Text style={styles.cameraButtonText}>
              {hasPermission ? 'Open Camera' : 'Grant Camera Permission'}
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

      {/* Permission Settings Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPermissionModal}
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View style={styles.permissionModalOverlay}>
          <View style={styles.permissionModalContent}>
            <View style={styles.permissionModalHeader}>
              <Text style={styles.permissionModalTitle}>Camera Permission Required</Text>
            </View>
            
            <View style={styles.permissionModalBody}>
              <Text style={styles.permissionModalMessage}>
                You've denied camera permission. To use gesture recognition, please enable it in your device settings.
              </Text>
              <Text style={styles.permissionModalSteps}>
                Settings → Apps → SignLink → Permissions → Camera
              </Text>
            </View>

            <View style={styles.permissionModalActions}>
              <TouchableOpacity
                style={[styles.permissionModalButton, styles.permissionCancelButton]}
                onPress={() => setShowPermissionModal(false)}
              >
                <Text style={styles.permissionCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.permissionModalButton, styles.permissionSettingsButton]}
                onPress={handleOpenSettings}
              >
                <Text style={styles.permissionSettingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Permission Modal Styles
  permissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionModalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    width: Dimensions.get('window').width * 0.85,
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  permissionModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  },
  permissionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  permissionModalBody: {
    padding: 20,
  },
  permissionModalMessage: {
    fontSize: 15,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 15,
  },
  permissionModalSteps: {
    fontSize: 13,
    color: theme.colors.primary,
    textAlign: 'center',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  permissionModalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  },
  permissionModalButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCancelButton: {
    borderRightWidth: 1,
    borderRightColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  },
  permissionCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  permissionSettingsButton: {
    backgroundColor: 'transparent',
  },
  permissionSettingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});

export default CameraMenuScreen;