import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
} from 'react-native';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    // Navigate to SignIn screen after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('SignIn');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121111",
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
    color: "#fff",
    fontFamily: "Poppins-ExtraBold", // Poppins font
    letterSpacing: 2,
  },
});
