import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import contactsService from '../utils/contactsService';
import socketService from '../utils/socketService';
import { getCurrentUser } from '../utils/auth';
import BottomNavigation from '../components/BottomNavigation';

const { width, height } = Dimensions.get('window');

export default function ContactsListScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingContact, setAddingContact] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [deletingContact, setDeletingContact] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    fetchContacts();
    fetchCurrentUser();
    initializeSocket();
  }, []);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const initializeSocket = async () => {
    try {
      if (!socketService.isSocketConnected()) {
        console.log('Initializing socket connection in ContactsListScreen...');
        await socketService.connect();
        console.log('Socket connected successfully in ContactsListScreen');
      }
    } catch (error) {
      console.error('Socket connection error in ContactsListScreen:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const contactsData = await contactsService.getContacts();
      setContacts(contactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to fetch contacts');
    } finally {
      setLoading(false);
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

  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setEmailSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setSearchingUsers(true);
      const users = await contactsService.searchUsers(query);
      setEmailSuggestions(users);
      setShowSuggestions(users.length > 0);
    } catch (error) {
      console.error('Error searching users:', error);
      setEmailSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleEmailChange = (text) => {
    setNewContactEmail(text);
    setShowSuggestions(false);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(text);
    }, 300); // 300ms delay
  };

  const handleSuggestionSelect = (user) => {
    setNewContactEmail(user.email);
    setShowSuggestions(false);
    setEmailSuggestions([]);
  };

  const handleAddContact = async () => {
    if (!newContactEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      setAddingContact(true);
      await contactsService.addContact(newContactEmail.trim());
      setNewContactEmail('');
      setShowAddContact(false);
      setShowSuggestions(false);
      setEmailSuggestions([]);
      await fetchContacts();
      Alert.alert('Success', 'Contact added successfully');
    } catch (error) {
      console.error('Error adding contact:', error);
      const errorMessage = error.response?.data?.error || 'Failed to add contact';
      Alert.alert('Error', errorMessage);
    } finally {
      setAddingContact(false);
    }
  };

  const handleLongPressContact = (contact) => {
    setContactToDelete(contact);
    setShowDeleteModal(true);
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;

    try {
      setDeletingContact(true);
      await contactsService.deleteContact(contactToDelete.id);
      setShowDeleteModal(false);
      setContactToDelete(null);
      await fetchContacts();
      Alert.alert('Success', 'Contact deleted successfully');
    } catch (error) {
      console.error('Error deleting contact:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete contact';
      Alert.alert('Error', errorMessage);
    } finally {
      setDeletingContact(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setContactToDelete(null);
  };

  const openCamera = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    };

    launchCamera(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      // Camera functionality can be implemented here
      console.log('Camera opened');
    });
  };

  const getProfileImageSource = (contact) => {
    if (contact?.photo) {
      if (contact.photo.startsWith('http')) {
        return { uri: contact.photo };
      } else {
        return { uri: `${process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com'}${contact.photo}` };
      }
    }
    return require('../../photos/Logo.png');
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
      <View style={styles.defaultCurrentUserProfileContainer}>
        <Text style={styles.defaultCurrentUserProfileText}>
          {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
        </Text>
      </View>
    );
  };

  const renderDefaultProfilePicture = (contact) => {
    return (
      <View style={styles.defaultProfileContainer}>
        <Text style={styles.defaultProfileText}>
          {contact?.name ? contact.name.charAt(0).toUpperCase() : 'U'}
        </Text>
      </View>
    );
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Now';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now - date) / (1000 * 60);

    if (diffInMinutes < 1) return 'Now';
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)} min`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr`;
    return 'Today';
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContact = ({ item: contact }) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => navigation.navigate('Conversation', { contact })}
      onLongPress={() => handleLongPressContact(contact)}
      delayLongPress={500}
    >
      <View style={styles.contactAvatarContainer}>
        {contact.photo ? (
          <Image
            source={getProfileImageSource(contact)}
            style={styles.contactAvatar}
            resizeMode="cover"
          />
        ) : (
          renderDefaultProfilePicture(contact)
        )}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name || 'Unknown'}</Text>
        <Text style={styles.contactPreview}>Tap to start • Long press to delete</Text>
      </View>
      <View style={styles.contactTimeContainer}>
        <Text style={styles.contactTime}>{formatTime(contact.lastMessageTime)}</Text>
      </View>
    </TouchableOpacity>
  );

  // Removed loading screen for smoother transitions

  return (
    <View style={styles.container}>
      {/* Background Circle */}
      <View style={styles.circle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.profileImageContainer}>
            {renderCurrentUserProfilePicture()}
            <View style={styles.onlineStatus} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Image
            source={require('../../photos/Search.png')}
            style={styles.searchIcon}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Recents Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.recentsButton}>
          <Image
            source={require('../../photos/chat.png')}
            style={styles.recentsIcon}
            resizeMode="contain"
          />
          <Text style={styles.recentsText}>Recents</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts List */}
      <View style={styles.contactsContainer}>
        {filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contacts yet</Text>
            <Text style={styles.emptySubtext}>Add contacts to start messaging</Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contactsList}
          />
        )}
      </View>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.floatingAddButton}
        onPress={() => setShowAddContact(true)}
      >
        <Image
          source={require('../../photos/add.png')}
          style={styles.addIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Add Contact Modal */}
      {showAddContact && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => {
              setShowSuggestions(false);
            }}
          >
            <TouchableOpacity 
              style={styles.modalContent} 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
            <Text style={styles.modalTitle}>Add Contact</Text>
            <View style={styles.emailInputContainer}>
              <Image
                source={require('../../photos/email.png')}
                style={styles.emailIcon}
                resizeMode="contain"
              />
              <TextInput
                style={styles.emailInput}
                placeholder="Enter email address"
                placeholderTextColor="#aaa"
                value={newContactEmail}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => {
                  if (emailSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
              />
              {searchingUsers && (
                <ActivityIndicator size="small" color="#7C01F6" style={styles.searchIndicator} />
              )}
            </View>
            
            {/* Email Suggestions Dropdown */}
            {showSuggestions && emailSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <ScrollView style={styles.suggestionsList} nestedScrollEnabled={true}>
                  {emailSuggestions.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.suggestionItem}
                      onPress={() => handleSuggestionSelect(user)}
                    >
                      <View style={styles.suggestionContent}>
                        {user.photo ? (
                          <Image source={{ uri: user.photo }} style={styles.suggestionAvatar} />
                        ) : (
                          <View style={styles.suggestionAvatarPlaceholder}>
                            <Text style={styles.suggestionAvatarText}>
                              {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.suggestionTextContainer}>
                          <Text style={styles.suggestionName}>{user.name || 'Unknown User'}</Text>
                          <Text style={styles.suggestionEmail}>{user.email}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddContact(false);
                  setNewContactEmail('');
                  setShowSuggestions(false);
                  setEmailSuggestions([]);
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addContactButton]}
                onPress={handleAddContact}
                disabled={addingContact}
              >
                {addingContact ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addContactButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      {/* Delete Contact Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Contact</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete {contactToDelete?.name || 'this contact'}? 
              This will also remove all call history with this contact.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteContact}
                disabled={deletingContact}
              >
                {deletingContact ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shared Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121111" // Static dark background
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
    filter: 'blur(99px)',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 50,
    elevation: 10,
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
    color: '#F9FAFB',
  },
  profileButton: {
    width: 50,
    height: 50,
  },
  profileImageContainer: {
    position: 'relative',
    width: 50,
    height: 50,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#374151',
  },
  defaultCurrentUserProfileContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
  },
  defaultCurrentUserProfileText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#1F2937',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  searchBar: {
    flexDirection: 'row',
    paddingTop: 5,
    paddingRight: 17,
    paddingBottom: 5,
    paddingLeft: 17,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: '#1F1F1F',
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: '#9CA3AF',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#F9FAFB',
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  recentsButton: {
    flexDirection: 'row',
    paddingTop: 6.195,
    paddingRight: 10.842,
    paddingBottom: 6.195,
    paddingLeft: 10.842,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28.653,
    backgroundColor: '#7C01F6', // Fallback for gradient
    alignSelf: 'flex-start',
  },
  recentsIcon: {
    width: 16,
    height: 16,
    marginRight: 6.195,
    tintColor: '#fff',
  },
  recentsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  contactsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contactsList: {
    paddingBottom: 120, // Increased for floating nav
  },
  contactCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1F1F1F', // Fallback for gradient
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactAvatarContainer: {
    marginRight: 15,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultProfileContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultProfileText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  contactPreview: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  contactTimeContainer: {
    alignItems: 'flex-end',
  },
  contactTime: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: 30.5,
    backgroundColor: '#7C01F6',
    shadowColor: '#7C01F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#121111',
    borderRadius: 30,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F9FAFB',
    marginBottom: 15,
    textAlign: 'center',
  },
  emailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.02,
    shadowRadius: 22,
    elevation: 2,
  },
  emailIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#7C01F6',
  },
  emailInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#F9FAFB',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 15,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#4B5563',
  },
  cancelButtonText: {
    color: '#F9FAFB',
    fontWeight: '600',
  },
  addContactButton: {
    backgroundColor: '#8B5CF6',
  },
  addContactButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteModalText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchIndicator: {
    marginLeft: 8,
  },
  suggestionsContainer: {
    maxHeight: 200,
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4B5563',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D2D',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  suggestionAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C01F6',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 2,
  },
  suggestionEmail: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
