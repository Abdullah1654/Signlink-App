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
      console.error('Error getting auth headers:', error);
      throw error;
    }
  }

  async addContact(email) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.post(
        `${API_BASE_URL}/contacts/add`,
        { email },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding contact:', error);
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
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }

  async getCallLogs() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/call-logs`,
        { headers }
      );
      return response.data.callLogs;
    } catch (error) {
      console.error('Error fetching call logs:', error);
      throw error;
    }
  }

  async getCallHistoryWithContact(contactId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/call-logs/${contactId}`,
        { headers }
      );
      return response.data.callLogs;
    } catch (error) {
      console.error('Error fetching call history:', error);
      throw error;
    }
  }

  async deleteContact(contactId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.delete(
        `${API_BASE_URL}/contacts/${contactId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  async searchUsers(query) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`,
        { headers }
      );
      return response.data.users;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }
}

export default new ContactsService();

