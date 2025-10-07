import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme, createThemedStyles } from '../utils/themeService';

const { width } = Dimensions.get('window');

export default function BottomNavigation() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  const getActiveRoute = () => {
    return route.name;
  };

  const isActive = (screenName) => {
    return getActiveRoute() === screenName;
  };

  const handleNavigation = (screenName) => {
    if (getActiveRoute() !== screenName) {
      navigation.navigate(screenName);
    }
  };

  const handleCameraPress = () => {
    navigation.navigate('CameraMenu');
  };

  return (
    <View style={styles.floatingBottomNavigation}>
      <TouchableOpacity 
        style={styles.navButton}
        onPress={handleCameraPress}
      >
        <Image
          source={require('../../photos/Camera.png')}
          style={[
            styles.navIcon,
            isActive('CameraMenu') && styles.activeNavIcon // Apply active style for CameraMenu
          ]}
          resizeMode="contain"
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => handleNavigation('ContactsList')}
      >
        <Image
          source={require('../../photos/chat.png')}
          style={[
            styles.navIcon,
            isActive('ContactsList') && styles.activeNavIcon
          ]}
          resizeMode="contain"
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => handleNavigation('CallLogs')}
      >
        <Image
          source={require('../../photos/Call.png')}
          style={[
            styles.navIcon,
            isActive('CallLogs') && styles.activeNavIcon
          ]}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  floatingBottomNavigation: {
    position: 'absolute',
    bottom: 30,
    left: (width - 345) / 2, // Center the 326px width
    width: 345,
    flexDirection: 'row',
    paddingTop: 15,
    paddingRight: 33,
    paddingBottom: 15,
    paddingLeft: 33,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderRadius: 55,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 19,
    elevation: 20,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 25,
    borderRadius: 15,
  },
  navIcon: {
    width: 28,
    height: 28,
    tintColor: theme.colors.textMuted, // Dimmed color for inactive
  },
  activeNavIcon: {
    tintColor: theme.colors.primary, // Primary color for active
  },
});