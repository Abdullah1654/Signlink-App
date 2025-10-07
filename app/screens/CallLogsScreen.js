import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import contactsService from '../utils/contactsService';
import BottomNavigation from '../components/BottomNavigation';
import { getCurrentUser } from '../utils/auth';
import { useTheme, createThemedStyles } from '../utils/themeService';

const { width, height } = Dimensions.get('window');

export default function CallLogsScreen({ navigation }) {
  const [callLogs, setCallLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  useEffect(() => {
    fetchCallLogs();
    fetchCurrentUser();
  }, []);

  const fetchCallLogs = async () => {
    try {
      const logsData = await contactsService.getCallLogs();
      setCallLogs(logsData);
    } catch (error) {
      console.error('Error fetching call logs:', error);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchCallLogs(),
        fetchCurrentUser()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const userData = await getCurrentUser();
      setCurrentUser(userData);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const getCurrentUserImageSource = () => {
    if (currentUser?.photo) {
      if (currentUser.photo.startsWith('http')) {
        return { uri: currentUser.photo };
      } else {
        return { uri: `${process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com'}${currentUser.photo}` };
      }
    }
    return require('../../photos/Logo.png');
  };

  const renderCurrentUserProfilePicture = () => {
    if (currentUser?.photo) {
      return (
        <Image
          source={getCurrentUserImageSource()}
          style={styles.profileImage}
          resizeMode="cover"
        />
      );
    }
    return (
      <View style={styles.defaultProfileContainer}>
        <Text style={styles.defaultProfileText}>
          {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
        </Text>
      </View>
    );
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


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    const diffInDays = Math.floor(diffInHours / 24);

    // Format time in 12-hour format
    const timeString = date.toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    if (diffInDays === 0) {
      return `Today ${timeString}`;
    } else if (diffInDays === 1) {
      return `Yesterday ${timeString}`;
    } else if (diffInDays < 7) {
      return `${date.toLocaleDateString('en-US', { weekday: 'long' })} ${timeString}`;
    } else {
      return `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'long' })} ${timeString}`;
    }
  };

  const getCallStatusIcon = (status, isOutgoing) => {
    switch (status) {
      case 'completed':
        return isOutgoing ? '📞' : '📞';
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

  const getCallDirectionText = (status, isOutgoing) => {
    switch (status) {
      case 'completed':
        return isOutgoing ? 'Outgoing' : 'Incoming';
      case 'missed':
        return 'Missed';
      case 'rejected':
        return isOutgoing ? 'Rejected' : 'Declined';
      case 'cancelled':
        return 'Cancelled';
      default:
        return isOutgoing ? 'Outgoing' : 'Incoming';
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

  const renderCallLog = ({ item: log }) => {
    // Determine if current user was the caller or receiver
    const isOutgoing = log.caller.id === currentUser?.id;
    const otherUser = isOutgoing ? log.receiver : log.caller;
    
    return (
      <TouchableOpacity
        style={styles.callLogItem}
        onPress={() => navigation.navigate('Conversation', { contact: otherUser })}
      >
        <View style={styles.callLogInfo}>
          {otherUser.photo ? (
            <Image
              source={getProfileImageSource(otherUser)}
              style={styles.callLogImage}
              resizeMode="cover"
            />
          ) : (
            renderDefaultProfilePicture(otherUser)
          )}
          <View style={styles.callLogDetails}>
            <Text style={styles.callLogName}>{otherUser.name || 'Unknown'}</Text>
            <View style={styles.callLogInfoRow}>
              <Text style={styles.callLogDirection}>
                {getCallDirectionText(log.status, isOutgoing)}
              </Text>
              <Text style={styles.callLogTime}>{formatDate(log.startTime)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.callLogStatus}>
          <Text style={[styles.callStatusIcon, { color: getCallStatusColor(log.status) }]}>
            {getCallStatusIcon(log.status, isOutgoing)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Circle */}
      <View style={styles.circle} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calls</Text>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          {renderCurrentUserProfilePicture()}
          <View style={styles.onlineIndicator} />
        </TouchableOpacity>
      </View>

      {/* Call Logs List */}
      <View style={styles.callLogsContainer}>
        {callLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No call logs yet</Text>
            <Text style={styles.emptySubtext}>Your call history will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={callLogs}
            renderItem={renderCallLog}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.callLogsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#7C01F6']}
                tintColor="#7C01F6"
                title="Pull to refresh"
                titleColor="#9CA3AF"
              />
            }
          />
        )}
      </View>

      {/* Shared Bottom Navigation */}
      <BottomNavigation />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  profileButton: {
    position: 'relative',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultProfileContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultProfileText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  callLogsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  callLogsList: {
    paddingBottom: 100,
  },
  callLogItem: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callLogInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  callLogImage: {
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
  callLogDetails: {
    flex: 1,
  },
  callLogName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  callLogInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callLogDirection: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  callLogTime: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  callLogStatus: {
    alignItems: 'center',
  },
  callStatusIcon: {
    fontSize: 20,
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
});

