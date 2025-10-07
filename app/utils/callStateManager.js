import { Alert } from 'react-native';
import { navigate } from './navigationService';

class CallStateManager {
  constructor() {
    this.navigation = null;
    this.currentIncomingCall = null;
    this.listeners = [];
    this.handledCalls = new Set();
    this.socketCallbacks = {
      acceptCall: null,
      rejectCall: null,
      endCall: null,
    };
    this.modalVisible = false;
    this.modalCallbacks = {
      showModal: null,
      hideModal: null,
    };
    this.toastCallbacks = {
      showInfo: null,
      showError: null,
      showSuccess: null,
    };
  }

  setNavigation(navigation) {
    this.navigation = navigation;
  }

  setSocketCallbacks(callbacks) {
    this.socketCallbacks = { ...this.socketCallbacks, ...callbacks };
  }

  setModalCallbacks(callbacks) {
    this.modalCallbacks = { ...this.modalCallbacks, ...callbacks };
  }

  setToastCallbacks(callbacks) {
    this.toastCallbacks = { ...this.toastCallbacks, ...callbacks };
  }

  getCurrentRoute() {
    if (this.navigation && this.navigation.getCurrentRoute) {
      return this.navigation.getCurrentRoute()?.name;
    }
    return null;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in call state listener:', error);
      }
    });
  }

  handleIncomingCall(callData) {
    if (!callData.callId || !callData.caller || !callData.caller.id) {
      console.error('Invalid incoming call data:', callData);
      return;
    }
    if (this.handledCalls.has(callData.callId)) {
      console.log('Call already handled, ignoring:', callData.callId);
      return;
    }
    this.handledCalls.add(callData.callId);
    this.currentIncomingCall = callData;

    const currentRoute = this.getCurrentRoute();
    console.log('Current route:', currentRoute);

    if (currentRoute === 'VideoCall') {
      console.log('User already in a call, rejecting incoming call');
      this.rejectCall(callData.callId);
      return;
    }

    this.showCallAlert(callData);
    this.notifyListeners('incoming-call', callData);
  }

  showCallAlert(callData) {
    console.log('Showing call alert for:', callData.caller.name);
    
    // Use custom modal if available, otherwise fall back to Alert
    if (this.modalCallbacks.showModal) {
      this.modalVisible = true;
      this.modalCallbacks.showModal(callData);
    } else {
      // Fallback to basic Alert
      Alert.alert(
        'Incoming Video Call',
        `${callData.caller.name || 'Someone'} is calling you`,
        [
          {
            text: 'Reject',
            style: 'destructive',
            onPress: () => this.rejectCall(callData.callId),
          },
          {
            text: 'Accept',
            style: 'default',
            onPress: () => this.acceptCall(callData),
          },
        ],
        { cancelable: false }
      );
    }
  }

  async acceptCall(callData) {
    console.log('Accepting call:', callData.callId);
    try {
      if (this.socketCallbacks.acceptCall) {
        await this.socketCallbacks.acceptCall(callData.callId);
      } else {
        console.error('Accept call callback not set');
        return;
      }
      this.currentIncomingCall = null;
      this.modalVisible = false;
      if (this.modalCallbacks.hideModal) {
        this.modalCallbacks.hideModal();
      }
      navigate('VideoCall', {
        contact: callData.caller,
        callId: callData.callId,
        isInitiator: false,
      });
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call');
    }
  }

  async rejectCall(callId) {
    console.log('Rejecting call:', callId);
    try {
      if (this.socketCallbacks.rejectCall) {
        await this.socketCallbacks.rejectCall(callId);
      } else {
        console.error('Reject call callback not set');
        return;
      }
      this.currentIncomingCall = null;
      this.modalVisible = false;
      if (this.modalCallbacks.hideModal) {
        this.modalCallbacks.hideModal();
      }
      this.handledCalls.delete(callId);
      this.notifyListeners('call-rejected', { callId });
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  }

  async endCall(callId) {
    console.log('Ending call:', callId);
    try {
      if (this.socketCallbacks.endCall) {
        await this.socketCallbacks.endCall(callId);
      } else {
        console.error('End call callback not set');
        return;
      }
      this.currentIncomingCall = null;
      this.handledCalls.delete(callId);
      this.handledCalls.clear();
      this.notifyListeners('call-ended', { callId });
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }

  // Handle missed call notifications
  handleMissedCallNotification(data) {
    console.log('Handling missed call notification:', data);
    console.log('Modal callbacks available:', !!this.modalCallbacks.hideModal);
    console.log('Toast callbacks available:', !!this.toastCallbacks?.showInfo);
    
    // Dismiss any incoming call modal/alert
    if (this.modalCallbacks.hideModal) {
      console.log('Dismissing incoming call modal');
      this.modalCallbacks.hideModal();
    } else {
      console.log('No hideModal callback available');
    }
    this.modalVisible = false;
    this.currentIncomingCall = null;
    this.handledCalls.delete(data.callId);
    
    // Show toast notification for missed call
    if (this.toastCallbacks && this.toastCallbacks.showInfo) {
      console.log('Showing missed call toast notification');
      this.toastCallbacks.showInfo(`Missed call from ${data.caller?.name || 'Unknown'}`, 5000);
    } else {
      console.log('No toast callback available');
    }
    this.notifyListeners('missed-call-notification', data);
  }

  // Handle call cancellation (when caller manually ends the call)
  handleCallCancellation(data) {
    console.log('Handling call cancellation:', data);
    // Hide any incoming call modals/alerts
    if (this.modalCallbacks.hideModal) {
      this.modalCallbacks.hideModal();
    }
    this.modalVisible = false;
    this.currentIncomingCall = null;
    this.handledCalls.delete(data.callId);
    this.notifyListeners('call-cancelled', data);
  }

  cleanup() {
    console.log('Cleaning up call state manager');
    this.currentIncomingCall = null;
    this.handledCalls.clear();
    this.listeners = [];
  }
}

export default new CallStateManager();