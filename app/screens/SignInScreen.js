import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform, Dimensions, Animated, Keyboard } from 'react-native';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useTheme, createThemedStyles } from '../utils/themeService';

const { width, height } = Dimensions.get('window');

const API = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  // Animation values for circles
  const circle1Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const circle2Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scrollViewRef = useRef(null);

  // Random movement animation for circles
  useEffect(() => {
    const animateCircle = (animValue, duration) => {
      const randomX = (Math.random() - 0.5) * 200; // Random movement within 200px
      const randomY = (Math.random() - 0.5) * 200;
      
      Animated.timing(animValue, {
        toValue: { x: randomX, y: randomY },
        duration: duration,
        useNativeDriver: true,
      }).start(() => {
        // Continue animation with new random values
        setTimeout(() => animateCircle(animValue, duration), 2000);
      });
    };

    // Start animations for both circles
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

  // Real-time validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle input changes with real-time validation
  const handleEmailChange = (text) => {
    setEmail(text);
    if (text && !validateEmail(text)) {
      setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
    } else {
      setErrors(prev => ({ ...prev, email: null }));
    }
  };

  async function handleLogin() {
    // Clear previous errors
    setErrors({});
    
    // Client-side validation
    const newErrors = {};
    
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!validateEmail(email)) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email: email.trim(), password });
      const { token } = res.data;
      await Keychain.setGenericPassword('authToken', token);
      navigation.replace('ContactsList');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      Alert.alert('Error', errorMessage);
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
            <Text style={styles.title}>Sign in to your{'\n'}Account</Text>
            <Text style={styles.subtitle}>
              Enter your Email and Password to login
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Google Sign-in Button */}
            <GoogleSignInButton navigation={navigation} screenType="signin" />

            {/* OR with lines */}
            <View style={styles.orContainer}>
              <View style={styles.orLine} />
              <Text style={styles.or}>Or Login with</Text>
              <View style={styles.orLine} />
            </View>

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

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.inputFull, errors.password && styles.inputError]}
                  placeholder="Enter your password"
                  placeholderTextColor="#aaa"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Image 
                    source={showPassword ? require("../../photos/eye_on.png") : require("../../photos/eye-off.png")}
                    style={styles.eyeIconImage}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.error}>{errors.password}</Text>}
            </View>

            {/* Remember Me and Forgot Password */}
            <View style={styles.rememberForgotContainer}>
              <TouchableOpacity 
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => navigation.navigate("ForgotPassword")}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? "Signing In..." : "Login"}
              </Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>
                Don't have an account?{" "}
                <Text
                  style={styles.signUpLink}
                  onPress={() => navigation.navigate("SignUp")}
                >
                  Sign Up
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
    color: theme.colors.text,
    textAlign: "center",
    lineHeight: 38
  },
  subtitle: { 
    fontSize: 13, 
    color: theme.colors.textSecondary, 
    marginTop: 10,
    marginBottom: -5,
  },
  form: {
    backgroundColor: theme.colors.card,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    zIndex: 10,
    elevation: 5,
    shadowColor: theme.colors.shadow,
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
    color: theme.colors.text,
    marginBottom: 6,
    marginLeft: 4,
  },
  inputFull: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBackground,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.text,
    height: 50,
  },
  inputError: { 
    borderColor: theme.colors.error 
  },
  passwordContainer: { 
    position: "relative" 
  },
  eyeIcon: { 
    position: "absolute", 
    right: 15, 
    top: 12,
    padding: 4,
  },
  eyeIconImage: {
    width: 20,
    height: 20,
  },
  error: { 
    color: theme.colors.error, 
    fontSize: 12, 
    marginLeft: 4,
    marginTop: 4,
  },
  rememberForgotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 3,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberMeText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: theme.colors.buttonPrimary,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.primaryLight,
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "600", 
    fontSize: 16 
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  or: { 
    color: theme.colors.textMuted, 
    marginHorizontal: 15,
    fontSize: 14,
  },
  signUpContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  signUpText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  signUpLink: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
});

