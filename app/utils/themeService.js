import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

// Theme definitions
export const themes = {
  light: {
    name: 'light',
    colors: {
      // Background colors
      background: '#FFFFFF',
      surface: '#F8F9FA',
      card: '#FFFFFF',
      
      // Text colors
      text: '#1F2937',
      textSecondary: '#6B7280',
      textMuted: '#9CA3AF',
      
      // Primary colors
      primary: '#8B5CF6',
      primaryLight: '#A78BFA',
      primaryDark: '#7C3AED',
      
      // Status colors
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
      
      // Border and divider colors
      border: '#E5E7EB',
      divider: '#F3F4F6',
      
      // Button colors
      buttonPrimary: '#8B5CF6',
      buttonSecondary: '#6B7280',
      buttonDanger: '#EF4444',
      buttonSuccess: '#10B981',
      
      // Input colors
      inputBackground: '#FFFFFF',
      inputBorder: '#D1D5DB',
      inputBorderFocused: '#8B5CF6',
      inputPlaceholder: '#9CA3AF',
      
      // Shadow colors
      shadow: '#000000',
      
      // Overlay colors
      overlay: 'rgba(0, 0, 0, 0.5)',
      overlayLight: 'rgba(0, 0, 0, 0.1)',
    },
    gradients: {
      primary: ['#8B5CF6', '#A78BFA'],
      background: ['#FFFFFF', '#F8F9FA'],
    }
  },
  dark: {
    name: 'dark',
    colors: {
      // Background colors
      background: '#121111',
      surface: '#1F1F1F',
      card: '#2D2D2D',
      
      // Text colors
      text: '#FFFFFF',
      textSecondary: '#D1D5DB',
      textMuted: '#9CA3AF',
      
      // Primary colors
      primary: '#8B5CF6',
      primaryLight: '#A78BFA',
      primaryDark: '#7C3AED',
      
      // Status colors
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
      
      // Border and divider colors
      border: '#374151',
      divider: '#2D2D2D',
      
      // Button colors
      buttonPrimary: '#8B5CF6',
      buttonSecondary: '#6B7280',
      buttonDanger: '#EF4444',
      buttonSuccess: '#10B981',
      
      // Input colors
      inputBackground: '#374151',
      inputBorder: '#4B5563',
      inputBorderFocused: '#8B5CF6',
      inputPlaceholder: '#9CA3AF',
      
      // Shadow colors
      shadow: '#000000',
      
      // Overlay colors
      overlay: 'rgba(0, 0, 0, 0.8)',
      overlayLight: 'rgba(0, 0, 0, 0.3)',
    },
    gradients: {
      primary: ['#8B5CF6', '#A78BFA'],
      background: ['#121111', '#1F1F1F'],
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(themes.dark); // Default to dark theme
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme) {
        const themeName = JSON.parse(savedTheme);
        setTheme(themes[themeName] || themes.dark);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = theme.name === 'dark' ? themes.light : themes.dark;
      setTheme(newTheme);
      await AsyncStorage.setItem('app_theme', JSON.stringify(newTheme.name));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setThemeByName = async (themeName) => {
    try {
      if (themes[themeName]) {
        setTheme(themes[themeName]);
        await AsyncStorage.setItem('app_theme', JSON.stringify(themeName));
      }
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  };

  const value = {
    theme,
    isDark: theme.name === 'dark',
    isLight: theme.name === 'light',
    toggleTheme,
    setThemeByName,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper function to create theme-aware styles
export const createThemedStyles = (styleFunction) => {
  return (theme) => styleFunction(theme);
};
