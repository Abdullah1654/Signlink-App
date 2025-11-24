//google sign in button for login and sign up
import React, { useEffect } from 'react';
import { TouchableOpacity, Alert, Text, View, StyleSheet, Image } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as Keychain from 'react-native-keychain';
import axios from 'axios';
import { useToast } from '../utils/toastService';

const API = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

export default function GoogleSignInButton({ navigation, screenType = 'signin' }) {
  const { showInfo, showError } = useToast();
  
  useEffect(() => {
    // 👇 Test backend connection
    console.log('Connecting to backend on ', API)
    axios
      .get(`${API}/`)
      .then(res => console.log("✅ Backend reachable:", res.data))
      .catch(err => console.error("❌ Backend not reachable:", err.message));
  }, []);

  async function signInWithGoogle() {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const userInfo = await GoogleSignin.signIn();
      console.log("Google user info:", userInfo);

      // ✅ Correct token path
      const idToken = userInfo?.data?.idToken;
      if (!idToken) {
        // User cancelled the sign-in - show subtle info message
        console.log("Google sign-in cancelled by user");
        showInfo("Sign-in cancelled");
        return;
      }

      console.log("Sending idToken to backend:", idToken.substring(0, 20) + "...");

      const res = await axios.post(`${API}/auth/google`, { idToken });
      console.log("Backend response:", res.data);

      // Store the authentication token
      const { token } = res.data;
      await Keychain.setGenericPassword('authToken', token);
      navigation.replace('ContactsList');
    } catch (err) {
      // Check if user cancelled the operation
      if (err.code === statusCodes.SIGN_IN_CANCELLED || 
          err.code === statusCodes.IN_PROGRESS ||
          err.message?.includes('SIGN_IN_CANCELLED') ||
          err.message?.includes('cancel')) {
        // User cancelled - show subtle info message instead of error
        console.log("Google sign-in cancelled by user");
        showInfo("Sign-in cancelled");
        return;
      }
      
      // Handle other errors with user-friendly messages
      console.error("Google sign-in error:", err.response?.data || err.message);
      
      let errorMessage = 'Unable to sign in with Google. Please try again.';
      
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play Services is not available on this device.';
      } else if (err.code === statusCodes.NO_INTERNET) {
        errorMessage = 'No internet connection. Please check your network and try again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (!err.response && err.message !== 'Network Error') {
        // Backend connection issue
        errorMessage = 'Unable to connect to server. Please try again later.';
      }
      
      showError(errorMessage);
    }
  }

  const getButtonText = () => {
    switch (screenType) {
      case 'signup':
        return 'Sign up with Google';
      case 'signin':
      default:
        return 'Continue with Google';
    }
  };

  return (
    <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle}>
      <Image 
        source={require('../../photos/google_icon.png')} 
        style={styles.googleIcon} 
        resizeMode="contain"
      />
      <Text style={styles.googleButtonText}>{getButtonText()}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
});

