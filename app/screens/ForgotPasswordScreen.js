import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Button, Alert, StyleSheet, Text, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform, Dimensions, Animated, Keyboard } from 'react-native';
import axios from 'axios';
import { useTheme, createThemedStyles } from '../utils/themeService';

const { width, height } = Dimensions.get('window');

const API = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  // Animation values for circles
  const circle1Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const circle2Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scrollViewRef = useRef(null);

  // Random movement animation for circles
  useEffect(() => {
    const animateCircle = (animValue, duration) => {
      const randomX = (Math.random() - 0.5) * 200;
      const randomY = (Math.random() - 0.5) * 200;
      
      Animated.timing(animValue, {
        toValue: { x: randomX, y: randomY },
        duration: duration,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => animateCircle(animValue, duration), 2000);
      });
    };

    animateCircle(circle1Anim, 3000);
    animateCircle(circle2Anim, 4000);
  }, []);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (text) => {
    setEmail(text);
    if (text && !validateEmail(text)) {
      setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
    } else {
      setErrors(prev => ({ ...prev, email: null }));
    }
  };

  async function sendOtp() {
    setErrors({});
    
    if (!email.trim()) {
      setErrors({ email: 'Email is required' });
      return;
    }
    
    if (!validateEmail(email)) {
      setErrors({ email: 'Invalid email format' });
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      Alert.alert("Success", "OTP sent to your email");
      navigation.navigate("ResetPassword", { email });
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Background Circles */}
      <Animated.View 
        style={[
          styles.circle1, 
          {
            transform: [
              { translateX: circle1Anim.x },
              { translateY: circle1Anim.y }
            ]
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.circle2, 
          {
            transform: [
              { translateX: circle2Anim.x },
              { translateY: circle2Anim.y }
            ]
          }
        ]} 
      />
      
      <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? 20 : 20 }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("../../photos/Logo.png")}
              style={styles.logo}
            />
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your email to receive{'\n'}password reset instructions
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.inputFull, errors.email && styles.inputError]}
                placeholder="Enter your email"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />
              {errors.email && <Text style={styles.error}>{errors.email}</Text>}
            </View>

            {/* Send OTP Button */}
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={sendOtp}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? "Sending..." : "Send OTP"}
              </Text>
            </TouchableOpacity>

            {/* Back to Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>
                Remember your password?{" "}
                <Text
                  style={styles.signInLink}
                  onPress={() => navigation.goBack()}
                >
                  Sign In
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  circle1: {
    position: 'absolute',
    top: -210,
    right: -105,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(124, 1, 246, 0.40)',
    shadowColor: '#7C01F6',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 99,
    elevation: 10,
    filter: 'blur(99px)',
  },
  circle2: {
    position: 'absolute',
    bottom: -175,
    left: -87.5,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(124, 1, 246, 0.40)',
    shadowColor: '#7C01F6',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 99,
    elevation: 10,
    filter: 'blur(99px)',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 20,
    paddingTop: 20,
  },
  header: { 
    alignItems: "center", 
    marginBottom: 32,
    paddingTop: 20,
  },
  logo: { 
    width: 90, 
    height: 90, 
    marginBottom: -13 
  },
  title: { 
    fontSize: 32, 
    fontWeight: "bold", 
    color: "#fff",
    textAlign: "center",
    lineHeight: 38
  },
  subtitle: { 
    fontSize: 13, 
    color: "#ccc", 
    marginTop: 10,
    textAlign: "center",
  },
  form: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
    marginLeft: 4,
  },
  inputFull: {
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: "500",
    color: "#575459",
    height: 50,
  },
  inputError: { 
    borderColor: "#EF4444" 
  },
  error: { 
    color: "#EF4444", 
    fontSize: 12, 
    marginLeft: 4,
    marginTop: 4,
  },
  button: {
    backgroundColor: "#8B5CF6",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#A78BFA',
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "600", 
    fontSize: 16 
  },
  signInContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  signInText: {
    fontSize: 14,
    color: '#666',
  },
  signInLink: {
    color: '#8B5CF6',
    fontWeight: 'bold',
  },
});

