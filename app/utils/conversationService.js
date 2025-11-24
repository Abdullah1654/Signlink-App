import * as Keychain from 'react-native-keychain';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

class ConversationService {
  async getAuthHeaders() {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (!credentials) {
        throw new Error('No authentication token found');
      }
      return {
        'Authorization': `Bearer ${credentials.password}`,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      throw error;
    }
  }

  async getConversationWithContact(contactId) {
    try {
      if (!contactId) {
        throw new Error('Contact ID is required');
      }
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/conversation/${contactId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch conversation: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      throw error;
    }
  }

  async getCallConversation(callLogId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/conversation/call/${callLogId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  groupMessagesByCall(messages) {
    if (!messages || !Array.isArray(messages)) {
      return {};
    }
    
    const grouped = {};
    messages.forEach(message => {
      if (!message || !message.callLogId) {
        return;
      }
      
      const callId = message.callLogId;
      if (!grouped[callId]) {
        grouped[callId] = {
          callLog: message.callLog || {},
          messages: []
        };
      }
      grouped[callId].messages.push(message);
    });
    return grouped;
  }

  async deleteCallMessages(callLogId) {
    try {
      if (!callLogId) {
        throw new Error('Call log ID is required');
      }
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/conversation/call/${callLogId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete messages: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }
}

export default new ConversationService();
