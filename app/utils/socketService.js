import io from 'socket.io-client';
import * as Keychain from 'react-native-keychain';
import callStateManager from './callStateManager';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://signlink-backend.onrender.com';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.globalListenersSetup = false;
    this.listeners = new Map();
  }

  async connect() {
    try {
      // If already connected, return early
      if (this.isConnected && this.socket) {
        console.log('Socket already connected');
        return;
      }

      const credentials = await Keychain.getGenericPassword();
      if (!credentials) {
        throw new Error('No authentication token found');
      }
      const { password: token } = credentials;

      console.log('Attempting to connect to socket server...');
      this.socket = io(API_BASE_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to server');
        this.isConnected = true;
        if (!this.globalListenersSetup) {
          this.setupGlobalCallListeners();
        }
        // Set up callbacks for callStateManager to break circular dependency
        this.setupCallStateManagerCallbacks();
        
        // Add any pending listeners that were registered before connection
        if (this.pendingListeners) {
          console.log('Adding pending listeners:', this.pendingListeners.length);
          this.pendingListeners.forEach(({ event, callback }) => {
            this.on(event, callback);
          });
          this.pendingListeners = [];
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
        this.isConnected = false;
      });

      // Wait for connection to be established
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'));
        }, 10000);

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Socket connection error:', error);
      throw error;
    }
  }

  setupGlobalCallListeners() {
    if (this.globalListenersSetup) return;
    this.socket.on('incoming-call', (data) => {
      if (!data.callId || !data.caller || !data.caller.id) {
        console.error('Invalid incoming call data:', data);
        return;
      }
      console.log('Global incoming call event:', data);
      callStateManager.handleIncomingCall(data);
    });

    // Handle missed call notifications
    this.socket.on('call-missed', (data) => {
      console.log('Call missed:', data);
      callStateManager.notifyListeners('call-missed', data);
    });

    this.socket.on('missed-call-notification', (data) => {
      console.log('Missed call notification:', data);
      callStateManager.handleMissedCallNotification(data);
    });

    // Handle call cancellation (when caller manually ends the call)
    this.socket.on('call-cancelled', (data) => {
      console.log('🔔 Global call-cancelled event received:', data);
      callStateManager.handleCallCancellation(data);
    });

    // Add global WebRTC listeners to handle offers/answers for any call
    this.socket.on('webrtc-offer', (data) => {
      console.log('🔔 Global WebRTC offer received:', data);
      // Store the offer globally so VideoCallScreen can access it
      this.pendingWebRTCOffer = data;
    });

    this.socket.on('webrtc-answer', (data) => {
      console.log('🔔 Global WebRTC answer received:', data);
      this.pendingWebRTCAnswer = data;
    });

    this.socket.on('webrtc-ice-candidate', (data) => {
      console.log('🔔 Global WebRTC ICE candidate received:', data);
      this.pendingWebRTCIceCandidate = data;
    });

    this.globalListenersSetup = true;
    console.log('Global call listeners set up');
  }

  isSocketConnected() {
    return this.isConnected && this.socket;
  }

  async initiateCall(targetUserId, callId) {
    if (!this.isSocketConnected()) {
      throw new Error('Socket not connected');
    }
    if (!targetUserId || !callId) {
      throw new Error('Invalid targetUserId or callId');
    }
    this.socket.emit('call-user', { targetUserId, callId });
    console.log('Initiated call to:', targetUserId, 'callId:', callId);
  }

  async acceptCall(callId) {
    if (!this.isSocketConnected()) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('accept-call', { callId });
    console.log('Accepted call:', callId);
  }

  async rejectCall(callId) {
    if (!this.isSocketConnected()) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('reject-call', { callId });
    console.log('Rejected call:', callId);
  }

  async endCall(callId) {
    if (!this.isSocketConnected()) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('end-call', { callId });
    console.log('Ended call:', callId);
  }

  sendOffer(targetUserId, offer) {
    if (!this.isSocketConnected()) {
      console.error('Socket not connected, cannot send offer');
      return;
    }
    this.socket.emit('webrtc-offer', { targetUserId, offer });
    console.log('Sent offer to:', targetUserId);
  }

  sendAnswer(targetUserId, answer) {
    if (!this.isSocketConnected()) {
      console.error('Socket not connected, cannot send answer');
      return;
    }
    this.socket.emit('webrtc-answer', { targetUserId, answer });
    console.log('Sent answer to:', targetUserId);
  }

  sendIceCandidate(targetUserId, candidate) {
    if (!this.isSocketConnected()) {
      console.error('Socket not connected, cannot send ICE candidate');
      return;
    }
    this.socket.emit('webrtc-ice-candidate', { targetUserId, candidate });
    console.log('Sent ICE candidate to:', targetUserId);
  }

  on(event, callback) {
    if (!this.socket) {
      console.error('Socket not initialized for event:', event);
      // Store the listener to be added when socket connects
      if (!this.pendingListeners) {
        this.pendingListeners = [];
      }
      this.pendingListeners.push({ event, callback });
      return;
    }
    
    // Add debugging wrapper for WebRTC events
    const wrappedCallback = (data) => {
      if (event.startsWith('webrtc-')) {
        console.log(`🔔 Socket received ${event}:`, data);
      }
      callback(data);
    };
    
    this.socket.on(event, wrappedCallback);
    this.listeners.set(`${event}_${callback.toString()}`, wrappedCallback);
    console.log('Added listener for:', event);
  }

  removeListener(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
    this.listeners.delete(`${event}_${callback.toString()}`);
    console.log('Removed listener for:', event);
  }

  setupCallStateManagerCallbacks() {
    callStateManager.setSocketCallbacks({
      acceptCall: (callId) => this.acceptCall(callId),
      rejectCall: (callId) => this.rejectCall(callId),
      endCall: (callId) => this.endCall(callId),
    });
  }

  getPendingWebRTCOffer() {
    const offer = this.pendingWebRTCOffer;
    this.pendingWebRTCOffer = null;
    return offer;
  }

  getPendingWebRTCAnswer() {
    const answer = this.pendingWebRTCAnswer;
    this.pendingWebRTCAnswer = null;
    return answer;
  }

  getPendingWebRTCIceCandidate() {
    const candidate = this.pendingWebRTCIceCandidate;
    this.pendingWebRTCIceCandidate = null;
    return candidate;
  }

  // Gesture data transmission methods
  sendGestureData(targetUserId, gestureData) {
    if (!this.isSocketConnected()) {
      console.error('Socket not connected, cannot send gesture data');
      return;
    }
    this.socket.emit('gesture-data', { targetUserId, gestureData });
    console.log('Sent gesture data to:', targetUserId, gestureData);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.globalListenersSetup = false;
      this.listeners.clear();
      this.pendingListeners = [];
      console.log('Socket disconnected');
    }
  }
}

export default new SocketService();


