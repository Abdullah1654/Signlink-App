import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme, createThemedStyles } from '../utils/themeService';
import { isAuthenticated, getCurrentUser } from '../utils/auth';

export default function SplashScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuthenticationStatus();
  }, [navigation]);

  const checkAuthenticationStatus = async () => {
    try {
      // Show splash screen for at least 2 seconds for better UX
      const minSplashTime = new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if token exists in keychain
      const hasToken = await isAuthenticated();
      
      if (hasToken) {
        // Validate token with backend
        try {
          await getCurrentUser();
          // Token is valid, wait for minimum splash time then navigate
          await minSplashTime;
          navigation.replace('ContactsList');
        } catch (error) {
          // Token exists but is invalid/expired
          console.log('Token validation failed:', error.message);
          await minSplashTime;
          navigation.replace('SignIn');
        }
      } else {
        // No token found
        await minSplashTime;
        navigation.replace('SignIn');
      }
    } catch (error) {
      // Error checking authentication
      console.error('Error checking authentication:', error);
      // On error, navigate to SignIn to be safe
      setTimeout(() => {
        navigation.replace('SignIn');
      }, 2000);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Circle */}
      <View style={styles.circle} />
      
      {/* Content */}
      <View style={styles.content}>
        <Image
          source={require("../../photos/Logo.png")}
          style={styles.logo}
        />
        <Text style={styles.brandName}>SIGNLINK</Text>
        
        {/* Loading indicator */}
        {isChecking && (
          <ActivityIndicator 
            size="large" 
            color={theme.colors.primary} 
            style={styles.loader}
          />
        )}
      </View>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  circle: {
    position: 'absolute',
    bottom: -262.5, // Positioned at bottom
    width: 507,
    height: 525,
    borderRadius: 300,
    backgroundColor: 'rgba(124, 1, 246, 0.64)',
    opacity: 0.21,
    shadowColor: '#7C01F6',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 50,
    elevation: 10,
    filter: 'blur(99px)',
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  brandName: {
    fontSize: 32,
    fontWeight: "800", // Extra bold
    color: theme.colors.text,
    fontFamily: "Poppins-ExtraBold", // Poppins font
    letterSpacing: 2,
  },
  loader: {
    marginTop: 30,
  },
});
