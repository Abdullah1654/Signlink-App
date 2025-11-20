import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Button,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  TextInput,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { logout, getCurrentUser, updateProfilePicture, isAuthenticated, deleteAccount, updateProfile } from '../utils/auth';
import socketService from '../utils/socketService';
import callStateManager from '../utils/callStateManager';
import { useToast } from '../utils/toastService';
import { useTheme, createThemedStyles } from '../utils/themeService';

// Use the same API base URL as in auth.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [updating, setUpdating] = useState(false);
  const { showSuccess, showError } = useToast();
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  // Animation values for circles
  const circle1Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const circle2Anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    checkAuthAndFetchData();
    initializeSocket();
  }, []);

  const initializeSocket = async () => {
    try {
      await socketService.connect();
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  };

  // Consistent circular animation for both circles
  useEffect(() => {
    const circlePositions = [
      { x: 0, y: 0 },
      { x: 50, y: -50 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 0 },
    ];

    const animateCircle = (animValue, currentIndex = 0) => {
      const nextIndex = (currentIndex + 1) % circlePositions.length;
      
      Animated.timing(animValue, {
        toValue: circlePositions[nextIndex],
        duration: 5000,
        useNativeDriver: true,
      }).start(() => {
        animateCircle(animValue, nextIndex);
      });
    };

    // Start animations for both circles
    animateCircle(circle1Anim);
    animateCircle(circle2Anim);
  }, []);

  // No automatic redirect - user stays on profile screen

  const checkAuthAndFetchData = async () => {
    try {
      setLoading(true);
      
      // Try to fetch user data directly
      await fetchUserData();
    } catch (error) {
      console.error('Error in checkAuthAndFetchData:', error);
      // Only redirect to SignIn if it's a clear authentication error
      if (error.message === 'No token found' || error.response?.status === 401) {
        navigation.replace('SignIn');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      
      // Initialize first and last name from the full name
      if (userData?.name) {
        const nameParts = userData.name.split(' ');
        setFirstName(nameParts[0] || '');
        setLastName(nameParts.slice(1).join(' ') || '');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      
      // Only show error for non-authentication issues
      if (error.message !== 'No token found') {
        showError('Failed to fetch user data. Please try again.');
      }
      // Don't redirect automatically - let the user stay on the profile screen
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Select Profile Picture',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => openCamera() },
        { text: 'Gallery', onPress: () => openGallery() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openCamera = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    };

    launchCamera(options, handleImageResponse);
  };

  const openGallery = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    };

    launchImageLibrary(options, handleImageResponse);
  };

  const handleImageResponse = async (response) => {
    if (response.didCancel || response.errorMessage) {
      return;
    }

    if (response.assets && response.assets[0]) {
      const imageUri = response.assets[0].uri;
      if (imageUri) {
        try {
          setUploading(true);
          const result = await updateProfilePicture(imageUri);
          setUser(result.user);
          showSuccess('Profile picture updated successfully!');
        } catch (error) {
          console.error('Error updating profile picture:', error);
          showError('Failed to update profile picture');
        } finally {
          setUploading(false);
        }
      }
    }
  };

  const getProfileImageSource = () => {
    if (user?.photo) {
      if (user.photo.startsWith('http')) {
        // Google photo
        return { uri: user.photo };
      } else {
        // Local uploaded photo - use the API_BASE_URL
        return { uri: `${API_BASE_URL}${user.photo}` };
      }
    }
    // Default profile picture - using Logo.png as fallback
    return require('../../photos/Logo.png');
  };

  const renderDefaultProfilePicture = () => {
    return (
      <View style={styles.defaultProfileContainer}>
        <Text style={styles.defaultProfileText}>
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </Text>
      </View>
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'This is your last chance. Are you absolutely sure you want to delete your account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Delete Forever',
          style: 'destructive',
          onPress: executeDeleteAccount,
        },
      ]
    );
  };

  const executeDeleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteAccount();
      
      // Clear local storage and navigate to sign in
      await logout(navigation);
      
      showSuccess('Account deleted successfully');
      setTimeout(() => {
        navigation.replace('SignIn');
      }, 1500);
    } catch (error) {
      console.error('Error deleting account:', error);
      showError('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditProfile = () => {
    setEditing(true);
  };

  const handleCancelEdit = () => {
    // Reset to original values
    if (user?.name) {
      const nameParts = user.name.split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
    }
    setEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showError('First name and last name are required');
      return;
    }

    try {
      setUpdating(true);
      const result = await updateProfile(firstName.trim(), lastName.trim());
      setUser(result.user);
      setEditing(false);
      showSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Failed to update profile. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Removed loading screen for smoother transitions

  // Show loading or empty state if no user data yet
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
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
      
      <View style={styles.contentContainer}>
        {deleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.deletingText}>Deleting account...</Text>
          </View>
        )}
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <View style={styles.headerButtons}>
            {editing ? (
              <>
                <TouchableOpacity 
                  style={[styles.headerButton, styles.cancelButton]}
                  onPress={handleCancelEdit}
                  disabled={updating}
                >
                  <Text style={styles.headerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.headerButton, styles.saveButton]}
                  onPress={handleSaveProfile}
                  disabled={updating}
                >
                  <Text style={styles.headerButtonText}>
                    {updating ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity 
                  style={styles.themeToggleButton}
                  onPress={toggleTheme}
                >
                  <Text style={styles.themeToggleIcon}>
                    {isDark ? '☀️' : '🌙'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={handleEditProfile}
                >
                  <Text style={styles.editIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={showImagePicker}
                  disabled={uploading}
                >
                  <Text style={styles.editIcon}>📷</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.profileImageContainer} 
            onPress={showImagePicker}
            disabled={uploading}
          >
            {user?.photo ? (
              <Image
                source={getProfileImageSource()}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              renderDefaultProfilePicture()
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          <Text style={styles.userName}>{user?.name || 'No name provided'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'No email provided'}</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            {editing ? (
              <TextInput
                style={[styles.inputField, styles.textInput]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#9CA3AF"
                editable={!updating}
              />
            ) : (
              <View style={styles.inputField}>
                <Text style={styles.inputText}>
                  {user?.name ? user.name.split(' ')[0] : 'No first name'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            {editing ? (
              <TextInput
                style={[styles.inputField, styles.textInput]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor="#9CA3AF"
                editable={!updating}
              />
            ) : (
              <View style={styles.inputField}>
                <Text style={styles.inputText}>
                  {user?.name ? user.name.split(' ').slice(1).join(' ') : 'No last name'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputField}>
              <Text style={styles.inputText}>
                {user?.email || 'No email provided'}
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.logoutButton]}
              onPress={() => logout(navigation)}
            >
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.deleteButton]}
              onPress={handleDeleteAccount}
              disabled={deleting}
            >
              <Text style={styles.buttonText}>
                {deleting ? "Deleting..." : "Delete Account"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
    top: -175,
    right: -87.5,
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
  contentContainer: {
    flex: 1,
    paddingBottom: 20,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggleIcon: {
    fontSize: 18,
    color: '#fff',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    fontSize: 16,
    color: '#fff',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.buttonSecondary,
  },
  saveButton: {
    backgroundColor: theme.colors.buttonSuccess,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: theme.colors.text,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
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
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.text,
    marginBottom: 8,
  },
  inputField: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 10,
    minHeight: 50,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: "500",
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
  },
  button: {
    flex: 1,
    backgroundColor: theme.colors.buttonPrimary,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutButton: {
    backgroundColor: theme.colors.buttonDanger,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "600", 
    fontSize: 16 
  },
  defaultProfileContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: theme.colors.text,
  },
  defaultProfileText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  deletingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
  },
});

