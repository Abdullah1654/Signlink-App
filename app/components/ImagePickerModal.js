import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme, createThemedStyles } from '../utils/themeService';

const { height } = Dimensions.get('window');

export default function ImagePickerModal({ visible, onClose, onCamera, onGallery, onDelete, hasPhoto }) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleOption = (callback) => {
    handleClose();
    setTimeout(() => {
      callback();
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.handle} />
              
              <Text style={styles.title}>Update Profile Picture</Text>
              <Text style={styles.subtitle}>Choose an option</Text>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => handleOption(onCamera)}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconContainer}>
                    <Text style={styles.icon}>📷</Text>
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Camera</Text>
                    <Text style={styles.optionSubtitle}>Take a new photo</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => handleOption(onGallery)}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconContainer}>
                    <Text style={styles.icon}>🖼️</Text>
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Gallery</Text>
                    <Text style={styles.optionSubtitle}>Choose from library</Text>
                  </View>
                </TouchableOpacity>

                {hasPhoto && onDelete && (
                  <TouchableOpacity
                    style={[styles.optionButton, styles.deleteOptionButton]}
                    onPress={() => handleOption(onDelete)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconContainer, styles.deleteIconContainer]}>
                      <Text style={styles.icon}>🗑️</Text>
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={styles.optionTitle}>Delete Photo</Text>
                      <Text style={styles.optionSubtitle}>Remove profile picture</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const getStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: theme.colors.textSecondary,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 25,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 1, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 1, 246, 0.3)',
    borderRadius: 15,
    padding: 16,
    gap: 15,
  },
  deleteOptionButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  iconContainer: {
    width: 50,
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconContainer: {
    backgroundColor: '#DC2626',
  },
  icon: {
    fontSize: 24,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
