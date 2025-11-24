import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

const { width } = Dimensions.get('window');

const Toast = ({ 
  visible, 
  message, 
  type = 'success', // 'success', 'error', 'info'
  duration = 3000,
  onHide 
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      // Show animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      if (onHide) onHide();
    });
  };

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#7C01F6',
          borderColor: '#6D28D9',
        };
      case 'error':
        return {
          backgroundColor: '#EF4444',
          borderColor: '#DC2626',
        };
      case 'info':
        return {
          backgroundColor: '#8B5CF6',
          borderColor: '#7C3AED',
        };
      default:
        return {
          backgroundColor: '#7C01F6',
          borderColor: '#6D28D9',
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'ℹ';
      default:
        return '✓';
    }
  };

  if (!visible || !isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.toast, getToastStyle()]}>
        <View style={styles.toastContent}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{getIcon()}</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
    elevation: 10,
  },
  toast: {
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  closeIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
});

export default Toast;
