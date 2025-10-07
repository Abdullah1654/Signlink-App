import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import axios from "axios";
import * as Keychain from 'react-native-keychain';
import GoogleSignInButton from "../components/GoogleSignInButton";
import { useTheme, createThemedStyles } from '../utils/themeService';

const { width, height } = Dimensions.get('window');

const API = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

export default function SignUpScreen({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  // Animation values for circles
  const circle1Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const circle2Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

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

  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSignup = async () => {
    // Prevent multiple signup attempts
    if (isLoading) return;
    
    let newErrors = {};
    if (!firstName.trim()) newErrors.firstName = "First name required";
    if (!lastName.trim()) newErrors.lastName = "Last name required";
    if (!email.trim()) newErrors.email = "Email required";
    else if (!validateEmail(email)) newErrors.email = "Invalid email format";
    if (!password) newErrors.password = "Password required";
    else if (password.length < 6)
      newErrors.password = "Password must be 6+ chars";
    if (confirmPassword !== password)
      newErrors.confirmPassword = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({}); // Clear previous errors

    try {
      console.log('Attempting signup for:', email);
      
      const res = await axios.post(`${API}/auth/signup`, {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      });
      
      console.log('Signup response:', res.data);
      
      // Store the authentication token
      const { token } = res.data;
      await Keychain.setGenericPassword('authToken', token);
      
      console.log('Token stored successfully');
      
      // Navigate to ContactsList screen after successful signup
      navigation.replace('ContactsList');
    } catch (err) {
      console.error('Signup error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      const errorMessage = err.response?.data?.error || err.message || "Signup failed";
      setErrors({ api: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

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
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("../../photos/Logo.png")}
              style={styles.logo}
            />
            <Text style={styles.title}>Sign Up</Text>
            <Text style={styles.subtitle}>
              Already have an account?{" "}
              <Text
                style={styles.signInText}
                onPress={() => navigation.navigate("SignIn")}
              >
                Sign in
              </Text>
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
          {/* Row inputs */}
          <View style={styles.rowContainer}>
            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  placeholder="Enter first name"
                  placeholderTextColor="#aaa"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  placeholder="Enter last name"
                  placeholderTextColor="#aaa"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>
            {errors.firstName && <Text style={styles.error}>{errors.firstName}</Text>}
            {errors.lastName && <Text style={styles.error}>{errors.lastName}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.inputFull, errors.email && styles.inputError]}
              placeholder="Enter your email"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.error}>{errors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Set Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.inputFull, errors.password && styles.inputError]}
                placeholder="Enter password"
                placeholderTextColor="#aaa"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
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

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.inputFull, errors.confirmPassword && styles.inputError]}
                placeholder="Confirm your password"
                placeholderTextColor="#aaa"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Image 
                  source={showConfirmPassword ? require("../../photos/eye_on.png") : require("../../photos/eye-off.png")}
                  style={styles.eyeIconImage}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && (
              <Text style={styles.error}>{errors.confirmPassword}</Text>
            )}
          </View>

          {errors.api && <Text style={styles.error}>{errors.api}</Text>}

          {/* Sign Up Button */}
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleSignup}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? "Signing Up..." : "Sign Up"}
            </Text>
          </TouchableOpacity>

          {/* OR with lines */}
          <View style={styles.orContainer}>
            <View style={styles.orLine} />
            <Text style={styles.or}>Or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Google Sign-in */}
          <GoogleSignInButton navigation={navigation} screenType="signup" />
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
    minHeight: height,
  },
  header: { 
    alignItems: "center", 
    marginBottom: 32,
    paddingTop: 42,
  },
  logo: { 
    width: 90, 
    height: 90, 
    marginBottom: -13 
  },
  title: { 
    fontSize: 32, 
    fontWeight: "bold", 
    color: theme.colors.text 
  },
  subtitle: { 
    fontSize: 14, 
    color: theme.colors.textSecondary, 
    marginTop: 10,
  },
  signInText: { 
    color: theme.colors.primary, 
    fontWeight: "bold" 
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
  rowContainer: {
    marginBottom: 0,
  },
  row: { 
    flexDirection: "row", 
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  inputGroup: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.text,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBackground,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.text,
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
  error: { 
    color: theme.colors.error, 
    fontSize: 12, 
    marginLeft: 4,
    marginTop: 4,
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
    marginVertical: 0,
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
});

