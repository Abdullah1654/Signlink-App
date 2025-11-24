import axios from 'axios';
import * as Keychain from 'react-native-keychain';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

class ContactsService {
  async getAuthHeaders() {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (!credentials || !credentials.password) {
        throw new Error('No authentication token found');
      }
      return {
        Authorization: `Bearer ${credentials.password}`,
      };
    } catch (error) {
      throw error;
    }
  }

  async addContact(email) {
    try {
      if (!email || !email.trim()) {
        throw new Error('Email is required');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Invalid email format');
      }
      const headers = await this.getAuthHeaders();
      const response = await axios.post(
        `${API_BASE_URL}/contacts/add`,
        { email: email.trim() },
        { headers }
      );
      return response.data;
    } catch (error) {
      // Don't log to console to avoid React Native error warnings
      throw error;
    }
  }

  async getContacts() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/contacts`,
        { headers }
      );
      return response.data.contacts;
    } catch (error) {
      throw error;
    }
  }

  async getCallLogs() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/calls/logs`,
        { headers }
      );
      return response.data.callLogs;
    } catch (error) {
      throw error;
    }
  }

  async getCallHistoryWithContact(contactId) {
    try {
      if (!contactId) {
        throw new Error('Contact ID is required');
      }
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/calls/logs/${contactId}`,
        { headers }
      );
      return response.data.callLogs || [];
    } catch (error) {
      throw error;
    }
  }

  async deleteContact(contactId) {
    try {
      if (!contactId) {
        throw new Error('Contact ID is required');
      }
      const headers = await this.getAuthHeaders();
      const response = await axios.delete(
        `${API_BASE_URL}/contacts/${contactId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchUsers(query) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/contacts/search?q=${encodeURIComponent(query.trim())}`,
        { headers }
      );
      return response.data.users || [];
    } catch (error) {
      throw error;
    }
  }
}

export default new ContactsService();

