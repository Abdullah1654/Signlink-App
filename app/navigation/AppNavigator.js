import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ContactsListScreen from '../screens/ContactsListScreen';
import CallLogsScreen from '../screens/CallLogsScreen';
import ConversationScreen from '../screens/ConversationScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import CameraMenuScreen from '../screens/CameraMenuScreen';
import callStateManager from '../utils/callStateManager';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ navigation }) {
  useEffect(() => {
    try {
      callStateManager.setNavigation(navigation);
    } catch (error) {
      console.error('Error initializing call state manager:', error);
    }
  }, [navigation]);

  return (
    <Stack.Navigator initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ContactsList" component={ContactsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CallLogs" component={CallLogsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VideoCall" component={VideoCallScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CameraMenu" component={CameraMenuScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}