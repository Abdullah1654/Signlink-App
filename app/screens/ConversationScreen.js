import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import uuid from 'react-native-uuid';
import contactsService from '../utils/contactsService';
import conversationService from '../utils/conversationService';
import socketService from '../utils/socketService';
import { useTheme, createThemedStyles } from '../utils/themeService';

const { width, height } = Dimensions.get('window');

export default function ConversationScreen({ navigation, route }) {
  const { contact } = route.params;
  const [callHistory, setCallHistory] = useState([]);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [groupedConversations, setGroupedConversations] = useState({});
  const [activeTab, setActiveTab] = useState('conversation'); // 'conversation' or 'calls'
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  useEffect(() => {
    fetchCallHistory();
    fetchConversationMessages();
  }, [contact]);

  const fetchCallHistory = async () => {
    try {
      const historyData = await contactsService.getCallHistoryWithContact(contact.id);
      setCallHistory(historyData);
    } catch (error) {
      console.error('Error fetching call history:', error);
    }
  };

  const fetchConversationMessages = async () => {
    try {
      const messages = await conversationService.getConversationWithContact(contact.id);
      setConversationMessages(messages);
      
      // Group messages by call
      const grouped = conversationService.groupMessagesByCall(messages);
      setGroupedConversations(grouped);
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
    }
  };

  const handleDeleteCallMessages = (callLogId, callDate) => {
    Alert.alert(
      'Delete Messages',
      `Are you sure you want to delete all messages from the call on ${callDate}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await conversationService.deleteCallMessages(callLogId);
              
              // Remove the deleted call from grouped conversations
              setGroupedConversations(prev => {
                const updated = { ...prev };
                delete updated[callLogId];
                return updated;
              });
              
              // Update conversation messages list
              setConversationMessages(prev => 
                prev.filter(message => message.callLogId !== callLogId)
              );
              
              Alert.alert('Success', 'Messages deleted successfully');
            } catch (error) {
              console.error('Error deleting messages:', error);
              Alert.alert('Error', 'Failed to delete messages. Please try again.');
            }
          },
        },
      ]
    );
  };

  const initiateCall = () => {
    const callId = uuid.v4();
    navigation.navigate('VideoCall', {
      contact,
      callId,
      isInitiator: true
    });
  };

  const getProfileImageSource = (user) => {
    if (user?.photo) {
      if (user.photo.startsWith('http')) {
        return { uri: user.photo };
      } else {
        return { uri: `${process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com'}${user.photo}` };
      }
    }
    return require('../../photos/Logo.png');
  };

  const renderDefaultProfilePicture = (user) => {
    return (
      <View style={styles.defaultProfileContainer}>
        <Text style={styles.defaultProfileText}>
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </Text>
      </View>
    );
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const getCallStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '📞';
      case 'missed':
        return '📵';
      case 'rejected':
        return '❌';
      case 'cancelled':
        return '🚫';
      default:
        return '📞';
    }
  };

  const getCallStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'missed':
        return '#EF4444';
      case 'rejected':
        return '#F59E0B';
      case 'cancelled':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const renderMessage = ({ item: message }) => {
    // Note: We need to get the current user ID to properly determine if it's own message
    // For now, we'll assume messages from the contact are "other" messages
    const isOwnMessage = message.senderId !== contact.id;
    const messageType = message.messageType === 'gesture' ? '🤟' : '🎤';
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={styles.messageTypeIcon}>{messageType}</Text>
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {conversationService.formatMessageTime(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderConversationGroup = ({ item: [callId, group] }) => {
    const callLog = group.callLog;
    const messages = group.messages;
    const callDate = new Date(callLog.startTime).toLocaleDateString();
    
    return (
      <View style={styles.conversationGroup}>
        <View style={styles.callHeader}>
          <View style={styles.callHeaderContent}>
            <View style={styles.callHeaderInfo}>
              <Text style={styles.callHeaderText}>
                Call on {callDate} at {new Date(callLog.startTime).toLocaleTimeString()}
              </Text>
              <Text style={styles.callDuration}>
                Duration: {callLog.duration ? Math.floor(callLog.duration / 60) + ':' + (callLog.duration % 60).toString().padStart(2, '0') : 'N/A'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteCallMessages(callLog.id, callDate)}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          style={styles.messagesList}
        />
      </View>
    );
  };

  const renderCallHistoryItem = ({ item: call }) => (
    <View style={styles.callHistoryItem}>
      <View style={styles.callHistoryInfo}>
        <Text style={[styles.callStatusIcon, { color: getCallStatusColor(call.status) }]}>
          {getCallStatusIcon(call.status)}
        </Text>
        <View style={styles.callHistoryDetails}>
          <Text style={styles.callHistoryTime}>{formatDate(call.startTime)}</Text>
          {call.duration && (
            <Text style={styles.callHistoryDuration}>
              Duration: {formatDuration(call.duration)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  // Removed loading screen for smoother transitions

  return (
    <View style={styles.container}>
      {/* Background Circle */}
      <View style={styles.circle} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.contactInfo}>
          {contact.photo ? (
            <Image
              source={getProfileImageSource(contact)}
              style={styles.contactImage}
              resizeMode="cover"
            />
          ) : (
            renderDefaultProfilePicture(contact)
          )}
          <View style={styles.contactDetails}>
            <Text style={styles.contactName}>{contact.name || 'Unknown'}</Text>
            <View style={styles.statusContainer}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'conversation' && styles.activeTab]}
          onPress={() => setActiveTab('conversation')}
        >
          <Text style={[styles.tabText, activeTab === 'conversation' && styles.activeTabText]}>
            Conversation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'calls' && styles.activeTab]}
          onPress={() => setActiveTab('calls')}
        >
          <Text style={[styles.tabText, activeTab === 'calls' && styles.activeTabText]}>
            Call History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.contentContainer}>
        {activeTab === 'conversation' ? (
          // Conversation Messages
          <View style={styles.conversationContainer}>
            {Object.keys(groupedConversations).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No conversation yet</Text>
                <Text style={styles.emptySubtext}>Start a video call to begin conversation</Text>
              </View>
            ) : (
              <FlatList
                data={Object.entries(groupedConversations)}
                renderItem={renderConversationGroup}
                keyExtractor={([callId]) => callId.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.conversationList}
              />
            )}
          </View>
        ) : (
          // Call History
          <View style={styles.callHistoryContainer}>
            {callHistory.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No call history yet</Text>
                <Text style={styles.emptySubtext}>Start a call to see history here</Text>
              </View>
            ) : (
              <FlatList
                data={callHistory}
                renderItem={renderCallHistoryItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.callHistoryList}
              />
            )}
          </View>
        )}
      </View>

      {/* Call Button */}
      <View style={styles.bottomCallContainer}>
        <TouchableOpacity 
          style={styles.mainCallButton}
          onPress={initiateCall}
        >
          <Text style={styles.mainCallIcon}>📞</Text>
          <Text style={styles.mainCallText}>Start Video Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  circle: {
    position: 'absolute',
    bottom: -262.5,
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  defaultProfileContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  defaultProfileText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  callHistoryContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 15,
  },
  callHistoryList: {
    paddingBottom: 20,
  },
  callHistoryItem: {
    backgroundColor: theme.colors.card,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  callHistoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callStatusIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  callHistoryDetails: {
    flex: 1,
  },
  callHistoryTime: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  callHistoryDuration: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  bottomCallContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  mainCallButton: {
    backgroundColor: '#10B981',
    borderRadius: 15,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  mainCallIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  mainCallText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  // Tab Navigation Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 4,
    marginBottom: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Content Container
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Conversation Styles
  conversationContainer: {
    flex: 1,
  },
  conversationList: {
    paddingBottom: 20,
  },
  conversationGroup: {
    marginBottom: 20,
  },
  callHeader: {
    backgroundColor: theme.colors.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  callHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callHeaderInfo: {
    flex: 1,
  },
  callHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  callDuration: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginLeft: 12,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  messagesList: {
    maxHeight: 300,
  },
  // Message Styles
  messageContainer: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ownMessageBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: theme.colors.card,
    borderBottomLeftRadius: 4,
  },
  messageTypeIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: theme.colors.text,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: theme.colors.textSecondary,
  },
});

