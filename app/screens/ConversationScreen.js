import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import uuid from 'react-native-uuid';
import contactsService from '../utils/contactsService';
import socketService from '../utils/socketService';

const { width, height } = Dimensions.get('window');

export default function ConversationScreen({ navigation, route }) {
  const { contact } = route.params;
  const [callHistory, setCallHistory] = useState([]);

  useEffect(() => {
    fetchCallHistory();
  }, [contact]);

  const fetchCallHistory = async () => {
    try {
      const historyData = await contactsService.getCallHistoryWithContact(contact.id);
      setCallHistory(historyData);
    } catch (error) {
      console.error('Error fetching call history:', error);
    }
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

      {/* Call History */}
      <View style={styles.callHistoryContainer}>
        <Text style={styles.sectionTitle}>Call History</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121111"
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
    color: '#ccc',
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
    color: '#fff',
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
    backgroundColor: '#8B5CF6',
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
    color: '#fff',
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
    color: '#fff',
    marginBottom: 15,
  },
  callHistoryList: {
    paddingBottom: 20,
  },
  callHistoryItem: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
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
    color: '#374151',
    marginBottom: 2,
  },
  callHistoryDuration: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
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
});

