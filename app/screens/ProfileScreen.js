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
  Modal,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { logout, getCurrentUser, updateProfilePicture, isAuthenticated, deleteAccount, updateProfile, deleteProfilePicture } from '../utils/auth';
import socketService from '../utils/socketService';
import callStateManager from '../utils/callStateManager';
import { useToast } from '../utils/toastService';
import { useTheme, createThemedStyles } from '../utils/themeService';
import ImagePickerModal from '../components/ImagePickerModal';

// Use the same API base URL as in auth.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [deletePhotoModalVisible, setDeletePhotoModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
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
    setImagePickerVisible(true);
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
          const errorMessage = error.response?.data?.error || 'Unable to update profile picture. Please try again.';
          showError(errorMessage);
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
    setDeleteAccountModalVisible(true);
  };

  const confirmDeleteAccount = () => {
    setDeleteAccountModalVisible(false);
    executeDeleteAccount();
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
      let errorMessage = 'Unable to delete account. Please try again.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Your session has expired. Please sign in again.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (!error.response) {
        errorMessage = 'No internet connection. Please check your network and try again.';
      }
      
      showError(errorMessage);
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
      showError('Both first name and last name are required');
      return;
    }

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      showError('Names must be at least 2 characters long');
      return;
    }

    try {
      setUpdating(true);
      const result = await updateProfile(firstName.trim(), lastName.trim());
      if (result && result.user) {
        setUser(result.user);
        setEditing(false);
        showSuccess('Profile updated successfully!');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.error || 'Unable to update profile. Please try again.';
      showError(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteProfilePicture = () => {
    if (!user?.photo) {
      showError('No profile picture to delete');
      return;
    }

    setDeletePhotoModalVisible(true);
  };

  const executeDeleteProfilePicture = async () => {
    try {
      setDeletingPhoto(true);
      const result = await deleteProfilePicture();
      if (result && result.user) {
        setUser(result.user);
        showSuccess('Profile picture deleted successfully!');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Unable to delete profile picture. Please try again.';
      showError(errorMessage);
    } finally {
      setDeletingPhoto(false);
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
            disabled={uploading || deletingPhoto}
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
            {deletingPhoto && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.deletingPhotoText}>Deleting...</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <Text style={styles.userName}>{user?.name || 'No name provided'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'No email provided'}</Text>
          
          {editing && user?.photo && (
            <TouchableOpacity 
              style={styles.deletePhotoButtonLarge}
              onPress={handleDeleteProfilePicture}
              disabled={deletingPhoto || uploading}
            >
              <Text style={styles.deletePhotoButtonText}>
                {deletingPhoto ? 'Deleting Photo...' : '🗑️ Delete Profile Picture'}
              </Text>
            </TouchableOpacity>
          )}
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

          {editing ? (
            <View style={styles.editButtonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.deleteProfileButton]}
                onPress={handleDeleteAccount}
                disabled={deleting || updating}
              >
                <Text style={styles.buttonText}>
                  {deleting ? "Deleting..." : "Delete Profile"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
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
          )}
        </View>
      </View>

      <ImagePickerModal
        visible={imagePickerVisible}
        onClose={() => setImagePickerVisible(false)}
        onCamera={openCamera}
        onGallery={openGallery}
        onDelete={handleDeleteProfilePicture}
        hasPhoto={!!user?.photo}
      />

      {/* Delete Photo Confirmation Modal */}
      <Modal
        visible={deletePhotoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeletePhotoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIconContainer}>
              <Text style={styles.deleteModalIcon}>🗑️</Text>
            </View>
            <Text style={styles.deleteModalTitle}>Delete Profile Picture</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete your profile picture?
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancelButton]}
                onPress={() => setDeletePhotoModalVisible(false)}
                disabled={deletingPhoto}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalDeleteButton]}
                onPress={() => {
                  setDeletePhotoModalVisible(false);
                  executeDeleteProfilePicture();
                }}
                disabled={deletingPhoto}
              >
                <Text style={styles.deleteModalDeleteText}>
                  {deletingPhoto ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteAccountModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={[styles.deleteModalIconContainer, styles.deleteAccountIconContainer]}>
              <Text style={styles.deleteModalIcon}>⚠️</Text>
            </View>
            <Text style={styles.deleteModalTitle}>Delete Account</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancelButton]}
                onPress={() => setDeleteAccountModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalDeleteButton]}
                onPress={confirmDeleteAccount}
                disabled={deleting}
              >
                <Text style={styles.deleteModalDeleteText}>
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  deletePhotoButton: {
    backgroundColor: '#DC2626',
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
  deletingPhotoText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
    fontWeight: '500',
  },
  deletePhotoButtonLarge: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#DC2626',
    borderRadius: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deletePhotoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  editButtonContainer: {
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
  deleteProfileButton: {
    backgroundColor: '#DC2626',
    width: '100%',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 25,
    padding: 30,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  deleteModalIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteModalIcon: {
    fontSize: 36,
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    height: 44,
  },
  deleteModalCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  deleteModalDeleteButton: {
    backgroundColor: '#DC2626',
  },
  deleteModalCancelText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteModalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  deleteAccountIconContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
});

