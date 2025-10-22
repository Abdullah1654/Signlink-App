import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Keychain from 'react-native-keychain';
import axios from 'axios';
import { reset as resetNavigation } from './navigationService';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

export async function getCurrentUser() {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (!credentials || !credentials.password) {
      throw new Error('No token found');
    }

  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${credentials.password}`,
      },
    });

    return response.data.user;
  } catch (error) {
    console.error('Error fetching user data:', error);
    
    // If it's a 401 error, the token might be invalid
    if (error.response?.status === 401) {
      // Clear the invalid token
      await Keychain.resetGenericPassword();
      throw new Error('No token found');
    }
    
    throw error;
  }
}

export async function isAuthenticated() {
  try {
    const credentials = await Keychain.getGenericPassword();
    return !!(credentials && credentials.password);
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

export async function updateProfilePicture(imageUri) {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (!credentials || !credentials.password) {
      throw new Error('No token found');
    }

    const formData = new FormData();
    formData.append('photo', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    });

    const response = await axios.post(
      `${API_BASE_URL}/auth/update-profile-picture`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${credentials.password}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating profile picture:', error);
    throw error;
  }
}

export async function updateProfile(firstName, lastName) {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (!credentials || !credentials.password) {
      throw new Error('No token found');
    }

    const response = await axios.put(
      `${API_BASE_URL}/auth/update-profile`,
      { firstName, lastName },
      {
        headers: {
          Authorization: `Bearer ${credentials.password}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

export async function deleteAccount() {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (!credentials || !credentials.password) {
      throw new Error('No token found');
    }

    const response = await axios.delete(`${API_BASE_URL}/auth/delete-account`, {
      headers: {
        Authorization: `Bearer ${credentials.password}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}

export async function logout(navigation) {
  try {
    await GoogleSignin.signOut();
  } catch (e) {
    console.warn('Google signout failed', e);
  }
  try {
    await Keychain.resetGenericPassword();
  } catch (e) {
    console.warn('Keychain reset failed', e);
  }
  try {
    if (navigation && typeof navigation.reset === 'function') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn' }],
      });
      return;
    }
  } catch (e) {
    console.warn('Navigation reset failed, falling back to replace', e);
  }
  // If navigation prop isn't available, try global reset
  try {
    resetNavigation('SignIn');
    return;
  } catch (e) {
    // ignore and try final fallback
  }
  // Final fallback to replace if nothing else worked
  navigation?.replace?.('SignIn');
}

