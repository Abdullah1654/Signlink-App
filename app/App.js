import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import callStateManager from './utils/callStateManager';
import { navigationRef } from './utils/navigationService';
import IncomingCallModal from './components/IncomingCallModal';
import { ToastProvider, useToast } from './utils/toastService';

function AppContent() {
  const [incomingCall, setIncomingCall] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { showInfo, showError, showSuccess } = useToast();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '598693972673-qi2knurr6mtulkouasorgefkhqrt5uco.apps.googleusercontent.com',
      offlineAccess: true,
    });

    // Set up modal callbacks for call state manager
    callStateManager.setModalCallbacks({
      showModal: (callData) => {
        console.log('App: Showing modal for call:', callData);
        setIncomingCall(callData);
        setModalVisible(true);
      },
      hideModal: () => {
        console.log('App: Hiding modal');
        setModalVisible(false);
        setIncomingCall(null);
      },
    });

    // Set up toast callbacks for call state manager
    callStateManager.setToastCallbacks({
      showInfo,
      showError,
      showSuccess,
    });
    
    console.log('App: Call state manager callbacks set up');
  }, [showInfo, showError, showSuccess]);

  const handleAcceptCall = () => {
    if (incomingCall) {
      callStateManager.acceptCall(incomingCall);
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      callStateManager.rejectCall(incomingCall.callId);
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        console.log('Navigation container ready');
        callStateManager.setNavigation(navigationRef);
      }}
    >
      <AppNavigator />
      <IncomingCallModal
        visible={modalVisible}
        caller={incomingCall?.caller}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SafeAreaProvider>
  );
}