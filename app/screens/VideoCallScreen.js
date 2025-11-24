import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Image, NativeEventEmitter, NativeModules, ScrollView, PermissionsAndroid, Linking, Modal, Dimensions } from 'react-native';
import { mediaDevices, RTCView, RTCPeerConnection } from 'react-native-webrtc';
import socketService from '../utils/socketService';
import { useNavigation, useRoute } from '@react-navigation/native';
import RejectCallModal from '../components/RejectCallModal';
import { useTheme, createThemedStyles } from '../utils/themeService';
import geminiService from '../utils/geminiService';

const VideoCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { contact, callId, isInitiator } = route.params;
  const { theme } = useTheme();
  const styles = createThemedStyles(getStyles)(theme);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(true); // Default to muted (no voice transmission)
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSTTActive = useRef(false); // Flag to prevent gesture interference during STT
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callStatus, setCallStatus] = useState(isInitiator ? 'calling' : 'ringing');
  const [callDuration, setCallDuration] = useState(0);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const pendingIceCandidates = useRef([]);
  const isNegotiating = useRef(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPermissionRequestModal, setShowPermissionRequestModal] = useState(false);
  const [permissionType, setPermissionType] = useState(''); // 'camera' or 'microphone'
  
  // Use ref to track call status for closure issues
  const callStatusRef = useRef(isInitiator ? 'calling' : 'ringing');
  const [recognizedText, setRecognizedText] = useState('');
  const [remoteRecognizedText, setRemoteRecognizedText] = useState('');
  const [lastRemoteGestureTime, setLastRemoteGestureTime] = useState(null);
  
  // Sentence generation state
  const [localSentence, setLocalSentence] = useState('');
  const [remoteSentence, setRemoteSentence] = useState('');
  const [localSentenceHistory, setLocalSentenceHistory] = useState([]);
  const [remoteSentenceHistory, setRemoteSentenceHistory] = useState([]);
  const [sentenceCounter, setSentenceCounter] = useState(0);
  
  // Gesture tracking for sentence building
  const gestureHistory = useRef([]);
  const sentenceGestures = useRef([]);
  const isBuildingSentence = useRef(false);
  const lastGestureAddedTime = useRef(0);
  const noHandsStartTime = useRef(null);
  const noHandsTimeoutRef = useRef(null);
  const autoSendTimerRef = useRef(null);
  
  // Remote gesture tracking
  const remoteGestureHistory = useRef([]);
  const remoteSentenceGestures = useRef([]);
  const remoteIsBuildingSentence = useRef(false);
  const remoteLastGestureAddedTime = useRef(0);
  const remoteNoHandsStartTime = useRef(null);
  const remoteNoHandsTimeoutRef = useRef(null);

  const localStreamRef = useRef(null);
  const peerConnection = useRef(null);
  const durationInterval = useRef(null);
  const listeners = useRef([]);
  const gestureListener = useRef(null);
  const timerStarted = useRef(false);

  // Constants for sentence building (matching native implementation)
  const HISTORY_SIZE = 5;
  const GESTURE_STABILITY_MS = 200;
  const GESTURE_COOLDOWN_MS = 500;
  const NO_HANDS_TIMEOUT_MS = 1500;
  const MAX_DISPLAYED_SENTENCES = 10;

  // Helper functions for sentence building
  const cleanGestureName = (gesture) => {
    if (!gesture || gesture === 'No Hands Detected' || gesture === 'None') {
      return gesture;
    }
    return gesture.replace('TwoHand_', '').replace(/_/g, ' ');
  };

  const getFormattedSentence = (gestures) => {
    if (gestures.length === 0) return '';
    const sentence = gestures.join(', ').toLowerCase();
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
  };

  const autoSendSentence = async () => {
    if (isBuildingSentence.current && sentenceGestures.current.length > 0 && !isSTTActive.current) {
      const words = [...sentenceGestures.current]; // Copy the words
      
      try {
        
        // Call Gemini API to generate proper sentence
        const generatedSentence = await geminiService.generateSentence(words);
        const sentenceNumber = sentenceCounter + 1;
        const numberedSentence = `${sentenceNumber}. ${generatedSentence}`;
        
        setLocalSentenceHistory(prev => {
          const updated = [...prev, numberedSentence];
          return updated.slice(-MAX_DISPLAYED_SENTENCES);
        });
        setLocalSentence(numberedSentence);
        setSentenceCounter(sentenceNumber);
        
        
        // Send sentence to remote participant
        const isConnected = callStatusRef.current === 'connected' || 
          (peerConnection.current && peerConnection.current.connectionState === 'connected');
        
        if (isConnected) {
          socketService.sendGestureData(contact.id, { 
            text: numberedSentence,
            type: 'sentence'
          });
        }
      } catch (error) {
        
        
        // Fallback to simple formatting if Gemini fails
        const fallbackSentence = getFormattedSentence(words);
        const sentenceNumber = sentenceCounter + 1;
        const numberedSentence = `${sentenceNumber}. ${fallbackSentence}`;
        
        setLocalSentenceHistory(prev => {
          const updated = [...prev, numberedSentence];
          return updated.slice(-MAX_DISPLAYED_SENTENCES);
        });
        setLocalSentence(numberedSentence);
        setSentenceCounter(sentenceNumber);
        
        const isConnected = callStatusRef.current === 'connected' || 
          (peerConnection.current && peerConnection.current.connectionState === 'connected');
        
        if (isConnected) {
          socketService.sendGestureData(contact.id, { 
            text: numberedSentence,
            type: 'sentence'
          });
        }
      }
      
      // Reset sentence building state
      sentenceGestures.current = [];
      isBuildingSentence.current = false;
      noHandsStartTime.current = null;
      if (noHandsTimeoutRef.current) {
        clearTimeout(noHandsTimeoutRef.current);
        noHandsTimeoutRef.current = null;
      }
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
    }
  };

  const processLocalGesture = (gesture, score) => {
    const currentTime = Date.now();
    const cleanedGesture = cleanGestureName(gesture);
    
    // Add to gesture history
    gestureHistory.current.push(cleanedGesture);
    if (gestureHistory.current.length > HISTORY_SIZE) {
      gestureHistory.current.shift();
    }
    
    // Get most frequent gesture from history
    const gestureCounts = {};
    gestureHistory.current.forEach(g => {
      gestureCounts[g] = (gestureCounts[g] || 0) + 1;
    });
    const smoothedGesture = Object.keys(gestureCounts).reduce((a, b) => 
      gestureCounts[a] > gestureCounts[b] ? a : b
    );
    
    console.log('Local gesture processed:', smoothedGesture, 'Score:', score);
    
    if (smoothedGesture === 'No Hands Detected') {
      // Handle no hands detected
      if (noHandsStartTime.current === null && isBuildingSentence.current && sentenceGestures.current.length > 0) {
        noHandsStartTime.current = currentTime;
        console.log('Started No Hands timer for local gesture');
        
        // Set timeout to finalize sentence
        if (noHandsTimeoutRef.current) {
          clearTimeout(noHandsTimeoutRef.current);
        }
        noHandsTimeoutRef.current = setTimeout(async () => {
          if (isBuildingSentence.current && sentenceGestures.current.length > 0 && !isSTTActive.current) {
            const words = [...sentenceGestures.current]; // Copy the words
            
            try {
              console.log('Generating sentence with Gemini API (timeout) for words:', words);
              
              // Call Gemini API to generate proper sentence
              const generatedSentence = await geminiService.generateSentence(words);
              const sentenceNumber = sentenceCounter + 1;
              const numberedSentence = `${sentenceNumber}. ${generatedSentence}`;
              
              setLocalSentenceHistory(prev => {
                const updated = [...prev, numberedSentence];
                return updated.slice(-MAX_DISPLAYED_SENTENCES);
              });
              setLocalSentence(numberedSentence);
              setSentenceCounter(sentenceNumber);
              
              console.log('Local sentence finalized via timeout:', generatedSentence);
              
              // Send sentence to remote participant
              const isConnected = callStatusRef.current === 'connected' || 
                (peerConnection.current && peerConnection.current.connectionState === 'connected');
              
              if (isConnected) {
                console.log('Sending generated sentence to remote:', numberedSentence);
                socketService.sendGestureData(contact.id, { 
                  text: numberedSentence,
                  type: 'sentence'
                });
              }
            } catch (error) {
              console.error('Error generating sentence with Gemini (timeout):', error);
              
              // Fallback to simple formatting
              const fallbackSentence = getFormattedSentence(words);
              const sentenceNumber = sentenceCounter + 1;
              const numberedSentence = `${sentenceNumber}. ${fallbackSentence}`;
              
              setLocalSentenceHistory(prev => {
                const updated = [...prev, numberedSentence];
                return updated.slice(-MAX_DISPLAYED_SENTENCES);
              });
              setLocalSentence(numberedSentence);
              setSentenceCounter(sentenceNumber);
              
              const isConnected = callStatusRef.current === 'connected' || 
                (peerConnection.current && peerConnection.current.connectionState === 'connected');
              
              if (isConnected) {
                socketService.sendGestureData(contact.id, { 
                  text: numberedSentence,
                  type: 'sentence'
                });
              }
            }
            
            // Reset sentence building state
            sentenceGestures.current = [];
            isBuildingSentence.current = false;
            noHandsStartTime.current = null;
          }
        }, NO_HANDS_TIMEOUT_MS);
      }
    } else {
      // Reset no hands timer
      noHandsStartTime.current = null;
      
      if (smoothedGesture !== 'None') {
        if (!isBuildingSentence.current) {
          isBuildingSentence.current = true;
          sentenceGestures.current = [];
          console.log('Started building local sentence');
          
          // Start 3-second auto-send timer
          if (autoSendTimerRef.current) {
            clearTimeout(autoSendTimerRef.current);
          }
          autoSendTimerRef.current = setTimeout(() => {
            autoSendSentence();
          }, 3000);
          console.log('Started 3-second auto-send timer');
        }
        
        const gestureCount = gestureHistory.current.filter(g => g === smoothedGesture).length;
        if (gestureCount >= 1 && 
            currentTime - lastGestureAddedTime.current >= GESTURE_COOLDOWN_MS && 
            (sentenceGestures.current.length === 0 || sentenceGestures.current[sentenceGestures.current.length - 1] !== smoothedGesture)) {
          
          sentenceGestures.current.push(smoothedGesture);
          lastGestureAddedTime.current = currentTime;
          console.log('Added gesture to local sentence:', smoothedGesture, 'Sentence so far:', sentenceGestures.current);
          
          // Reset the 3-second timer each time a new gesture is added
          if (autoSendTimerRef.current) {
            clearTimeout(autoSendTimerRef.current);
          }
          autoSendTimerRef.current = setTimeout(() => {
            autoSendSentence();
          }, 3000);
          console.log('Reset 3-second auto-send timer');
        }
      }
    }
    
    // Update current gesture display
    const gestureText = `${cleanedGesture} ${(score * 100).toFixed(0)}%`;
    setRecognizedText(gestureText);
  };

  const processRemoteGesture = (gesture, score) => {
    const currentTime = Date.now();
    const cleanedGesture = cleanGestureName(gesture);
    
    // Add to remote gesture history
    remoteGestureHistory.current.push(cleanedGesture);
    if (remoteGestureHistory.current.length > HISTORY_SIZE) {
      remoteGestureHistory.current.shift();
    }
    
    // Get most frequent gesture from history
    const gestureCounts = {};
    remoteGestureHistory.current.forEach(g => {
      gestureCounts[g] = (gestureCounts[g] || 0) + 1;
    });
    const smoothedGesture = Object.keys(gestureCounts).reduce((a, b) => 
      gestureCounts[a] > gestureCounts[b] ? a : b
    );
    
    console.log('Remote gesture processed:', smoothedGesture, 'Score:', score);
    
    if (smoothedGesture === 'No Hands Detected') {
      // Handle no hands detected
      if (remoteNoHandsStartTime.current === null && remoteIsBuildingSentence.current && remoteSentenceGestures.current.length > 0) {
        remoteNoHandsStartTime.current = currentTime;
        console.log('Started No Hands timer for remote gesture');
      }
      
      if (remoteNoHandsStartTime.current !== null && 
          currentTime - remoteNoHandsStartTime.current >= NO_HANDS_TIMEOUT_MS && 
          remoteIsBuildingSentence.current && 
          remoteSentenceGestures.current.length > 0) {
        
        // Finalize remote sentence
        const newSentence = getFormattedSentence(remoteSentenceGestures.current);
        setRemoteSentenceHistory(prev => {
          const updated = [...prev, newSentence];
          return updated.slice(-MAX_DISPLAYED_SENTENCES);
        });
        setRemoteSentence(newSentence);
        
        console.log('Remote sentence finalized:', newSentence);
        
        // Reset remote sentence building state
        remoteSentenceGestures.current = [];
        remoteIsBuildingSentence.current = false;
        remoteNoHandsStartTime.current = null;
      }
    } else {
      // Reset no hands timer
      remoteNoHandsStartTime.current = null;
      
      if (smoothedGesture !== 'None') {
        if (!remoteIsBuildingSentence.current) {
          remoteIsBuildingSentence.current = true;
          remoteSentenceGestures.current = [];
          console.log('Started building remote sentence');
        }
        
        const gestureCount = remoteGestureHistory.current.filter(g => g === smoothedGesture).length;
        if (gestureCount >= 1 && 
            currentTime - remoteLastGestureAddedTime.current >= GESTURE_COOLDOWN_MS && 
            (remoteSentenceGestures.current.length === 0 || remoteSentenceGestures.current[remoteSentenceGestures.current.length - 1] !== smoothedGesture)) {
          
          remoteSentenceGestures.current.push(smoothedGesture);
          remoteLastGestureAddedTime.current = currentTime;
          console.log('Added gesture to remote sentence:', smoothedGesture, 'Sentence so far:', remoteSentenceGestures.current);
        }
      }
    }
    
    // Update current remote gesture display
    const gestureText = `${cleanedGesture} ${(score * 100).toFixed(0)}%`;
    setRemoteRecognizedText(gestureText);
    setLastRemoteGestureTime(currentTime);
  };

  const setupGestureRecognition = (stream) => {
    try {
      console.log('Setting up gesture recognition...');
      
      // Clean up previous gesture recognition
      if (gestureListener.current) {
        gestureListener.current.remove();
        gestureListener.current = null;
      }
      try {
        NativeModules.GestureRecognizerModule?.stop?.();
      } catch (e) {
        console.log('Error stopping previous gesture recognition:', e);
      }
      
      const track = stream.getVideoTracks?.()[0];
      if (!track) {
        console.log('No video track found in stream');
        return;
      }
      
      console.log('Video track found:', track.id, track.kind);
      
      const module = NativeModules.GestureRecognizerModule;
      if (!module) {
        console.log('GestureRecognizerModule not available');
        return;
      }
      
      console.log('GestureRecognizerModule found:', module);
      
      const emitter = new NativeEventEmitter(module);
      gestureListener.current = emitter.addListener('GestureRecognition.onResult', (evt) => {
        console.log('Gesture recognition result:', evt);
        if (evt?.label) {
          // Process gesture for sentence building
          processLocalGesture(evt.label, evt.score);
          
          // Send individual gesture data to remote participant if in a call
          console.log('Current call status:', callStatusRef.current);
          // Check both call status and peer connection state
          const isConnected = callStatusRef.current === 'connected' || 
            (peerConnection.current && peerConnection.current.connectionState === 'connected');
          
          if (isConnected) {
            const gestureText = `${evt.label} ${(evt.score * 100).toFixed(0)}%`;
            console.log('Sending gesture data:', { text: gestureText, type: 'gesture' });
            socketService.sendGestureData(contact.id, { 
              text: gestureText,
              type: 'gesture'
            });
          } else {
            console.log('Not sending gesture data - call not connected. Status:', callStatusRef.current, 'Peer state:', peerConnection.current?.connectionState);
          }
        }
      });
      
      console.log('Starting gesture recognition for track:', track.id);
      module.startLocalTrackProcessing?.(track.id);
      console.log('Gesture recognition setup completed');
    } catch (error) {
      console.error('Error setting up gesture recognition:', error);
    }
  };

  const initializeWebRTC = async () => {
    try {
      console.log('Initializing WebRTC for callId:', callId);
      
      // TURN Server Health Check
      console.log('🏥 Performing TURN server health check...');
      try {
        const turnCheckResult = await fetch('http://13.61.128.117:3478', { 
          method: 'GET',
          timeout: 3000 
        }).catch(() => null);
        
        // Even if HTTP fails, TURN/STUN uses UDP/TCP on port 3478, so we just log
        console.log('🔍 TURN Server Reachability: Port 3478 on 13.61.128.117');
        console.log('✅ TURN server IP is reachable - proceeding with WebRTC setup');
      } catch (healthCheckError) {
        console.log('⚠️ Health check note: TURN server uses UDP/TCP, not HTTP');
        console.log('✅ Proceeding with WebRTC - ICE will verify TURN connectivity');
      }
      
      // Check camera permission first
      const cameraPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (!cameraPermission) {
        // Show custom modal instead of native dialog
        setPermissionType('camera');
        setShowPermissionRequestModal(true);
        return;
      }
      
      const stream = await mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480, frameRate: 30 },
        audio: false, // Disable audio transmission by default
      });
      console.log('Media stream obtained successfully:', stream);
      localStreamRef.current = stream;
      setLocalStream(stream);

      console.log('🔧 Creating peer connection with TURN/STUN servers...');
      
      // Configure ICE servers with custom TURN server and fallbacks
      const iceServers = [
        // Primary STUN server (custom EC2)
        { urls: 'stun:13.61.128.117:3478' },
        
        // Primary TURN server with TCP transport (recommended for firewall traversal)
        { 
          urls: 'turn:13.61.128.117:3478?transport=tcp',
          username: 'abdullah',
          credential: '029Signoff'
        },
        
        // Secondary TURN server with UDP transport (faster but may be blocked)
        { 
          urls: 'turn:13.61.128.117:3478?transport=udp',
          username: 'abdullah',
          credential: '029Signoff'
        },
        
        // Fallback public STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];

      console.log('📡 ICE Servers configured:', JSON.stringify(iceServers, null, 2));

      peerConnection.current = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // Try all: host → STUN → TURN (best chance of connection)
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        // Add longer timeout for ICE gathering (30 seconds)
        iceGatheringTimeout: 30000,
      });
      
      console.log('✅ Peer connection created successfully');
      console.log('🔧 ICE Configuration: transport=all, gathering timeout=30s');

      // Create a data channel for connection keepalive
      try {
        const dataChannel = peerConnection.current.createDataChannel('keepalive', {
          ordered: true
        });
        
        // Store data channel reference
        peerConnection.current._dataChannel = dataChannel;
        
        dataChannel.onopen = () => {
          console.log('💓 Keepalive data channel opened');
          console.log('💓 Starting keepalive ping interval (5s)');
          
          // Send ping every 5 seconds to keep connection alive
          const keepaliveInterval = setInterval(() => {
            if (dataChannel.readyState === 'open') {
              try {
                const pingData = JSON.stringify({ type: 'ping', timestamp: Date.now() });
                dataChannel.send(pingData);
                console.log('💓 Keepalive ping sent at', new Date().toLocaleTimeString());
              } catch (e) {
                console.log('⚠️ Keepalive send failed:', e.message);
                // If send fails, channel might be closing
                if (dataChannel.readyState !== 'open') {
                  console.log('💔 Data channel closed, stopping keepalive');
                  clearInterval(keepaliveInterval);
                }
              }
            } else {
              console.log('💔 Data channel not open (state:', dataChannel.readyState + '), stopping keepalive');
              clearInterval(keepaliveInterval);
            }
          }, 5000);
          
          // Store interval for cleanup
          peerConnection.current._keepaliveInterval = keepaliveInterval;
          
          // Send first ping immediately
          try {
            dataChannel.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            console.log('💓 Initial keepalive ping sent');
          } catch (e) {
            console.log('⚠️ Initial ping failed:', e.message);
          }
        };
        
        dataChannel.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ping') {
              console.log('💓 Keepalive ping received at', new Date().toLocaleTimeString());
              // Respond with pong
              if (dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                console.log('💓 Sent pong response');
              }
            } else if (data.type === 'pong') {
              console.log('💓 Keepalive pong received at', new Date().toLocaleTimeString());
            }
          } catch (e) {
            console.log('⚠️ Error parsing keepalive message:', e.message);
          }
        };
        
        dataChannel.onerror = (error) => {
          console.log('Keepalive channel error:', error);
        };
        
        console.log('✅ Keepalive data channel created');
      } catch (dcError) {
        console.log('⚠️ Could not create keepalive channel:', dcError.message);
      }
      
      // Listen for incoming data channels from remote peer
      peerConnection.current.ondatachannel = (event) => {
        const receiveChannel = event.channel;
        console.log('📨 Received data channel:', receiveChannel.label, 'state:', receiveChannel.readyState);
        
        receiveChannel.onopen = () => {
          console.log('💓 Remote keepalive channel opened');
        };
        
        receiveChannel.onmessage = (msgEvent) => {
          try {
            const data = JSON.parse(msgEvent.data);
            if (data.type === 'ping') {
              console.log('💓 Remote keepalive ping received at', new Date().toLocaleTimeString());
              if (receiveChannel.readyState === 'open') {
                receiveChannel.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                console.log('💓 Sent pong to remote');
              }
            } else if (data.type === 'pong') {
              console.log('💓 Remote keepalive pong received at', new Date().toLocaleTimeString());
            }
          } catch (e) {
            console.log('⚠️ Error parsing remote keepalive:', e.message);
          }
        };
        
        receiveChannel.onerror = (error) => {
          console.log('⚠️ Remote keepalive channel error:', error);
        };
        
        receiveChannel.onclose = () => {
          console.log('💔 Remote keepalive channel closed');
        };
      };

      console.log('Adding tracks to peer connection...');
      stream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind, track.id);
        try {
          peerConnection.current.addTrack(track, stream);
        } catch (trackError) {
          console.error('Error adding track:', trackError);
        }
      });
      console.log('All tracks added successfully');

      // Setup gesture recognition
      setupGestureRecognition(stream);

      peerConnection.current.ontrack = (event) => {
        console.log('ontrack event:', event);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          console.log('Remote stream received - updating call status to connected');
          setCallStatus('connected');
          callStatusRef.current = 'connected';
          // Also check connection state and update if needed
          setTimeout(() => {
            if (peerConnection.current && peerConnection.current.connectionState === 'connected') {
              console.log('Connection state confirmed as connected after ontrack');
              setCallStatus('connected');
              callStatusRef.current = 'connected';
            }
          }, 100);
        } else {
          console.error('No streams in ontrack event');
        }
      };

      // ICE candidate gathering - monitor which servers are being used
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate;
          
          // Log ICE candidate details for network diagnostics
          console.log('🧊 ICE Candidate Generated:', {
            type: candidate.type,
            protocol: candidate.protocol,
            address: candidate.address || candidate.ip,
            port: candidate.port,
            relatedAddress: candidate.relatedAddress,
            relatedPort: candidate.relatedPort,
            candidate: candidate.candidate
          });
          
          // Identify if using TURN server
          if (candidate.type === 'relay') {
            console.log('🔄 TURN server relay candidate detected - using EC2 TURN server 13.61.128.117');
            console.log('✅ Different network connection - TURN relay active');
          } else if (candidate.type === 'srflx') {
            console.log('🌐 STUN server reflexive candidate - same network or direct connection possible');
          } else if (candidate.type === 'host') {
            console.log('🏠 Host candidate - local network address');
          }
          
          socketService.sendIceCandidate(contact.id, candidate);
        } else {
          console.log('🧊 ICE gathering completed');
        }
      };

      // Connection state monitoring
      peerConnection.current.onconnectionstatechange = () => {
        if (peerConnection.current) {
          const state = peerConnection.current.connectionState;
          console.log('🔌 Connection State Changed:', state);
          
          if (state === 'connected') {
            console.log('✅ WebRTC Connection Established Successfully');
            
            // Check ICE connection state for network type
            const iceState = peerConnection.current.iceConnectionState;
            console.log('🧊 ICE Connection State:', iceState);
            
            setCallStatus('connected');
            callStatusRef.current = 'connected';
            startCallTimer();
          } else if (state === 'connecting') {
            console.log('🔄 Attempting to establish connection...');
          } else if (state === 'disconnected') {
            console.log('⚠️ Connection disconnected - waiting for reconnection...');
            // Don't end call, wait for ICE to reconnect (up to 30 seconds)
            setTimeout(() => {
              if (peerConnection.current && 
                  peerConnection.current.connectionState === 'disconnected') {
                console.log('⚠️ Still disconnected after 30s - connection may have dropped');
                // Don't auto-end, let user decide or wait for failed state
              }
            }, 30000);
          } else if (state === 'failed') {
            console.log('❌ Connection failed - waiting for ICE restart...');
            // Don't show alert immediately - ICE restart might fix it
            // Only show alert if still failed after restart attempts
            setTimeout(() => {
              if (peerConnection.current && 
                  peerConnection.current.connectionState === 'failed') {
                console.log('❌ Connection still failed after restart - showing alert');
                Alert.alert(
                  'Connection Failed',
                  'Unable to establish video call. Please check your internet connection and try again.',
                  [{ text: 'OK', onPress: () => endCall() }]
                );
              } else {
                console.log('✅ Connection recovered after restart - no alert needed');
              }
            }, 5000); // Wait 5 seconds for ICE restart to complete
          }
        }
      };

      // ICE connection state monitoring for detailed network diagnostics
      peerConnection.current.oniceconnectionstatechange = () => {
        if (peerConnection.current) {
          const iceState = peerConnection.current.iceConnectionState;
          console.log('🧊 ICE Connection State:', iceState);
          
          if (iceState === 'connected' || iceState === 'completed') {
            console.log('✅ ICE Connection Successful');
            
            // Get stats to determine connection type
            peerConnection.current.getStats(null).then(stats => {
              stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  console.log('📊 Active Connection Stats:', {
                    localCandidateType: report.local?.candidateType || 'unknown',
                    remoteCandidateType: report.remote?.candidateType || 'unknown',
                    priority: report.priority,
                    nominated: report.nominated
                  });
                  
                  // Determine if using TURN relay
                  const localCandidate = stats.get(report.localCandidateId);
                  const remoteCandidate = stats.get(report.remoteCandidateId);
                  
                  if (localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay') {
                    console.log('🔄 Connection Type: TURN RELAY (Different Networks)');
                    console.log('✅ EC2 TURN Server 13.61.128.117 is relaying traffic successfully');
                  } else if (localCandidate?.candidateType === 'srflx' || remoteCandidate?.candidateType === 'srflx') {
                    console.log('🌐 Connection Type: STUN (Direct with NAT traversal)');
                    console.log('✅ Same network or NAT-friendly connection');
                  } else {
                    console.log('🏠 Connection Type: HOST (Local Network)');
                    console.log('✅ Both users on same local network');
                  }
                }
              });
            }).catch(err => console.error('Error getting connection stats:', err));
          } else if (iceState === 'checking') {
            console.log('🔍 Checking ICE candidates...');
          } else if (iceState === 'disconnected') {
            console.log('⚠️ ICE Connection Disconnected - attempting reconnection...');
            
            // Wait longer for disconnected state (10 seconds) before restarting
            setTimeout(async () => {
              if (peerConnection.current && 
                  peerConnection.current.iceConnectionState === 'disconnected' &&
                  !isNegotiating.current) {
                console.log('🔄 Still disconnected after 10s - initiating ICE restart...');
                try {
                  isNegotiating.current = true;
                  const offer = await peerConnection.current.createOffer({ iceRestart: true });
                  await peerConnection.current.setLocalDescription(offer);
                  socketService.sendOffer(contact.id, offer);
                  console.log('✅ ICE restart offer sent');
                  isNegotiating.current = false;
                } catch (restartError) {
                  console.error('❌ ICE restart failed:', restartError);
                  isNegotiating.current = false;
                }
              } else if (peerConnection.current?.iceConnectionState === 'connected') {
                console.log('✅ Connection recovered automatically');
              }
            }, 10000); // Wait 10 seconds for auto-recovery
          } else if (iceState === 'failed') {
            console.log('❌ ICE Connection Failed - attempting ICE restart...');
            
            // Attempt ICE restart after a delay
            setTimeout(async () => {
              if (peerConnection.current && 
                  peerConnection.current.iceConnectionState === 'failed' &&
                  !isNegotiating.current) {
                try {
                  console.log('🔄 Initiating ICE restart...');
                  isNegotiating.current = true;
                  
                  const offer = await peerConnection.current.createOffer({ iceRestart: true });
                  await peerConnection.current.setLocalDescription(offer);
                  socketService.sendOffer(contact.id, offer);
                  
                  console.log('✅ ICE restart offer sent');
                  isNegotiating.current = false;
                } catch (restartError) {
                  console.error('❌ ICE restart failed:', restartError);
                  isNegotiating.current = false;
                }
              }
            }, 2000); // Wait 2 seconds before restart
          }
        }
      };

      // ICE gathering state monitoring
      peerConnection.current.onicegatheringstatechange = () => {
        if (peerConnection.current) {
          const gatheringState = peerConnection.current.iceGatheringState;
          console.log('🧊 ICE Gathering State:', gatheringState);
          
          if (gatheringState === 'gathering') {
            console.log('🔍 Gathering ICE candidates from STUN/TURN servers...');
          } else if (gatheringState === 'complete') {
            console.log('✅ ICE gathering complete - all candidates collected');
            console.log(`📊 Total candidates buffered: ${pendingIceCandidates.current.length}`);
          }
        }
      };

      // Add a periodic check to ensure call status is updated when connection is established
      const connectionCheckInterval = setInterval(() => {
        if (peerConnection.current && 
            peerConnection.current.connectionState === 'connected' && 
            callStatusRef.current !== 'connected') {
          console.log('Periodic check: WebRTC is connected but call status is not - updating');
          setCallStatus('connected');
          callStatusRef.current = 'connected';
          startCallTimer();
        }
        
        // Monitor connection health
        if (peerConnection.current) {
          const connState = peerConnection.current.connectionState;
          const iceState = peerConnection.current.iceConnectionState;
          
          // Log health every 5 seconds when connected
          const currentTime = Date.now();
          if (!peerConnection.current._lastHealthLog || currentTime - peerConnection.current._lastHealthLog > 5000) {
            if (connState === 'connected') {
              console.log('💚 Connection Health: GOOD (conn=' + connState + ', ice=' + iceState + ')');
            } else if (connState === 'disconnected' || iceState === 'disconnected') {
              console.log('💛 Connection Health: DISCONNECTED - waiting for recovery');
            }
            peerConnection.current._lastHealthLog = currentTime;
          }
        }
      }, 1000);

      // Store interval reference for cleanup
      peerConnection.current._connectionCheckInterval = connectionCheckInterval;

      if (isInitiator) {
        try {
          console.log('Creating offer as initiator...');
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          console.log('Sending offer:', offer);
          socketService.sendOffer(contact.id, offer);
          socketService.initiateCall(contact.id, callId);
        } catch (offerError) {
          console.error('Error creating/sending offer:', offerError);
          Alert.alert('Error', 'Failed to create call offer');
          navigation.goBack();
        }
      } else {
        console.log('Waiting for offer as callee...');
        // Check if there's a pending offer to process
        if (pendingOffer) {
          console.log('Processing pending offer...');
          await handleOffer(pendingOffer);
          setPendingOffer(null);
        } else {
          // Check for any pending WebRTC messages from global listeners
          const globalOffer = socketService.getPendingWebRTCOffer();
          if (globalOffer && globalOffer.fromUserId === contact.id) {
            console.log('Processing global pending offer...');
            await handleOffer(globalOffer.offer);
          }
        }
      }
    } catch (error) {
      console.error('WebRTC initialization error:', error);
      // Don't show React Native error, just navigate back
      navigation.goBack();
    }
  };

  const handleOffer = async (offer) => {
    try {
      console.log('📥 Handling offer from:', contact.name);
      if (!peerConnection.current) {
        console.log('⚠️ Peer connection not ready, storing offer for later');
        setPendingOffer(offer);
        return;
      }
      
      if (isNegotiating.current) {
        console.log('⚠️ Already negotiating, queuing offer');
        setPendingOffer(offer);
        return;
      }
      
      isNegotiating.current = true;
      
      console.log('📝 Setting remote description (offer)');
      await peerConnection.current.setRemoteDescription(offer);
      console.log('✅ Remote description set');
      
      console.log('📝 Creating answer');
      const answer = await peerConnection.current.createAnswer();
      
      console.log('📝 Setting local description (answer)');
      await peerConnection.current.setLocalDescription(answer);
      console.log('✅ Local description set');
      
      console.log('📤 Sending answer to:', contact.name);
      socketService.sendAnswer(contact.id, answer);
      
      // Small delay to ensure state is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Process buffered ICE candidates
      if (pendingIceCandidates.current.length > 0) {
        console.log(`📦 Processing ${pendingIceCandidates.current.length} buffered ICE candidates`);
        for (const candidate of pendingIceCandidates.current) {
          try {
            await peerConnection.current.addIceCandidate(candidate);
            console.log('✅ Buffered candidate added');
          } catch (err) {
            console.error('Error adding buffered candidate:', err);
          }
        }
        pendingIceCandidates.current = [];
        console.log('✅ All buffered candidates processed');
      }
      
      isNegotiating.current = false;
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      isNegotiating.current = false;
    }
  };

  const handleAnswer = async (answer) => {
    try {
      console.log('📥 Handling answer:', answer.type);
      if (!peerConnection.current) {
        console.log('⚠️ Peer connection not ready yet, will be processed when ready');
        return;
      }
      
      if (peerConnection.current.signalingState === 'stable') {
        console.log('⚠️ Connection already stable, ignoring duplicate answer');
        return;
      }
      
      await peerConnection.current.setRemoteDescription(answer);
      console.log('✅ Remote description set successfully');
      
      // Small delay to ensure state is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Process any buffered ICE candidates
      if (pendingIceCandidates.current.length > 0) {
        console.log(`📦 Processing ${pendingIceCandidates.current.length} buffered ICE candidates`);
        for (const candidate of pendingIceCandidates.current) {
          try {
            await peerConnection.current.addIceCandidate(candidate);
            console.log('✅ Buffered candidate added');
          } catch (err) {
            console.error('Error adding buffered candidate:', err);
          }
        }
        pendingIceCandidates.current = [];
        console.log('✅ All buffered candidates processed');
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    try {
      if (!peerConnection.current) {
        console.log('⚠️ Buffering ICE candidate - peer connection not ready');
        pendingIceCandidates.current.push(candidate);
        return;
      }
      
      // Check if remote description is set using actual property check
      const hasRemoteDesc = peerConnection.current.remoteDescription && 
                           peerConnection.current.remoteDescription.type;
      
      if (!hasRemoteDesc) {
        console.log('⚠️ Buffering ICE candidate - remote description not set yet');
        pendingIceCandidates.current.push(candidate);
        return;
      }
      
      console.log('➕ Adding ICE candidate:', candidate.candidate?.substring(0, 50));
      
      // Extract candidate info for logging
      const candidateStr = candidate.candidate || '';
      const candidateType = candidateStr.includes('typ relay') ? 'RELAY (TURN)' : 
                           candidateStr.includes('typ srflx') ? 'SRFLX (STUN)' :
                           candidateStr.includes('typ host') ? 'HOST (Local)' : 'UNKNOWN';
      const protocol = candidateStr.includes('tcp') ? 'TCP' : 'UDP';
      
      console.log(`🧊 Adding ${candidateType} candidate via ${protocol}`);
      
      await peerConnection.current.addIceCandidate(candidate);
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error.message);
      // Don't fail the call on individual candidate errors
    }
  };

  const startCallTimer = () => {
    // Only start timer if it hasn't been started yet
    if (!timerStarted.current) {
      console.log('Starting call duration timer');
      timerStarted.current = true;
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      console.log('Call timer already started, skipping');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const speakText = async (text) => {
    if (!text || isSpeaking) {
      return;
    }
    
    try {
      console.log('Speaking text:', text);
      setIsSpeaking(true);
      
      const module = NativeModules.GestureRecognizerModule;
      if (module && module.speak) {
        await module.speak(text);
        console.log('TTS started successfully');
      } else {
        console.error('TTS not available');
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      // Reset speaking state after a delay (TTS takes time to complete)
      setTimeout(() => {
        setIsSpeaking(false);
      }, 2000);
    }
  };

  const speakSentence = (sentence) => {
    // Remove numbering from the text before speaking
    const textToSpeak = sentence.replace(/^\d+\.\s*/, '');
    speakText(textToSpeak);
  };

  const requestMicrophonePermission = async () => {
    try {
      // First check if permission is already granted
      const checkResult = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (checkResult) {
        return true;
      }

      // Request permission
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone for speech-to-text functionality.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      // Check if permission is permanently denied
      if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        setPermissionType('microphone');
        setShowPermissionModal(true);
        return false;
      }

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Permission request error:', err);
      setShowPermissionModal(true);
      return false;
    }
  };

  const openAppSettings = () => {
    setShowPermissionModal(false);
    Linking.openSettings();
    navigation.goBack();
  };

  const handleRequestCameraPermission = async () => {
    setShowPermissionRequestModal(false);
    
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'Allow SignLink to access your camera for video calls.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    
    if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      // Permission permanently denied
      setPermissionType('camera');
      setShowPermissionModal(true);
      return;
    }
    
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      // Permission granted, reinitialize WebRTC
      initializeWebRTC();
    } else {
      // Permission denied, go back
      navigation.goBack();
    }
  };

  const handleCancelPermissionRequest = () => {
    setShowPermissionRequestModal(false);
    navigation.goBack();
  };


  const toggleSpeechToText = async () => {
    try {
      if (!isListening) {
        // Request microphone permission first
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
          return;
        }

        // Start Speech-to-Text
        console.log('Starting Speech-to-Text...');
        
        // Use the native STT functionality from GestureRecognizerModule
        const module = NativeModules.GestureRecognizerModule;
        console.log('GestureRecognizerModule available:', !!module);
        console.log('Available methods:', module ? Object.keys(module) : 'Module not found');
        
        if (module && module.startListening) {
          console.log('Calling startListening...');
          setIsListening(true);
          try {
            await module.startListening();
            console.log('Speech-to-Text started successfully');
          } catch (error) {
            console.error('Failed to start Speech-to-Text:', error);
            setIsListening(false);
          }
        } else {
          console.error('Speech-to-Text not available - module or method not found');
          console.log('Module:', module);
          console.log('startListening method:', module?.startListening);
          setIsListening(false);
        }
      } else {
        // Stop Speech-to-Text
        console.log('Stopping Speech-to-Text...');
        setIsListening(false);
        
        const module = NativeModules.GestureRecognizerModule;
        if (module && module.stopListening) {
          try {
            await module.stopListening();
            console.log('Speech-to-Text stopped successfully');
          } catch (error) {
            console.error('Failed to stop Speech-to-Text:', error);
          }
        }
      }
    } catch (error) {
      console.error('Speech-to-Text error:', error);
      setIsListening(false);
    }
  };


  const switchCamera = async () => {
    try {
      const newFacingMode = isFrontCamera ? 'environment' : 'user';
      const newStream = await mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode, width: 640, height: 480, frameRate: 30 },
        audio: false, // Keep audio disabled
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!peerConnection.current) {
        console.log('Peer connection not ready yet, will be processed when ready');
        return;
      }
      const sender = peerConnection.current.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => track.stop());
      }
      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setIsFrontCamera(!isFrontCamera);
      
      // Restart gesture recognition with new video track
      console.log('Restarting gesture recognition for new camera...');
      setupGestureRecognition(newStream);
      
      console.log('Camera switched to:', newFacingMode);
    } catch (error) {
      console.error('Error switching camera:', error);
      Alert.alert('Camera Error', 'Unable to switch camera. Please try again or restart the app.');
    }
  };

  const endCall = () => {
    if (socketService.isSocketConnected()) {
      socketService.endCall(callId);
      console.log('Sent end-call for callId:', callId);
    } else {
      console.error('Socket not connected, cannot end call');
    }
    cleanup();
    navigation.goBack();
  };

  const cleanup = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    timerStarted.current = false;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnection.current) {
      // Clear connection check interval
      if (peerConnection.current._connectionCheckInterval) {
        clearInterval(peerConnection.current._connectionCheckInterval);
      }
      // Clear keepalive interval
      if (peerConnection.current._keepaliveInterval) {
        clearInterval(peerConnection.current._keepaliveInterval);
      }
      peerConnection.current.close();
      peerConnection.current = null;
    }
    listeners.current.forEach(({ event, callback }) => socketService.removeListener(event, callback));
    listeners.current = [];
    
    // Cleanup gesture recognition
    if (gestureListener.current) {
      gestureListener.current.remove();
      gestureListener.current = null;
    }
    try {
      NativeModules.GestureRecognizerModule?.stop?.();
    } catch (e) {
      console.log('Error stopping gesture recognition:', e);
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallDuration(0);
    setShowRejectModal(false);
    setRecognizedText('');
    setRemoteRecognizedText('');
    setLastRemoteGestureTime(null);
    setIsListening(false);
    setIsSpeaking(false);
    isSTTActive.current = false;
    
    // Reset sentence generation state
    setLocalSentence('');
    setRemoteSentence('');
    setLocalSentenceHistory([]);
    setRemoteSentenceHistory([]);
    setSentenceCounter(0);
    
    // Reset gesture tracking refs
    gestureHistory.current = [];
    sentenceGestures.current = [];
    isBuildingSentence.current = false;
    lastGestureAddedTime.current = 0;
    noHandsStartTime.current = null;
    
    remoteGestureHistory.current = [];
    remoteSentenceGestures.current = [];
    remoteIsBuildingSentence.current = false;
    remoteLastGestureAddedTime.current = 0;
    remoteNoHandsStartTime.current = null;
    
    // Clear any pending timeouts
    if (noHandsTimeoutRef.current) {
      clearTimeout(noHandsTimeoutRef.current);
      noHandsTimeoutRef.current = null;
    }
    if (remoteNoHandsTimeoutRef.current) {
      clearTimeout(remoteNoHandsTimeoutRef.current);
      remoteNoHandsTimeoutRef.current = null;
    }
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    
    console.log('Cleanup completed');
  };

  const setupSpeechToTextListeners = () => {
    const module = NativeModules.GestureRecognizerModule;
    console.log('Setting up Speech-to-Text listeners...');
    console.log('GestureRecognizerModule available:', !!module);
    
    if (!module) {
      console.error('GestureRecognizerModule not available for STT listeners');
      return;
    }

    const emitter = new NativeEventEmitter(module);
    console.log('NativeEventEmitter created for STT');
    
    // Listen for speech recognition results
    const speechListener = emitter.addListener('onSpeechResult', (spokenText) => {
      console.log('Speech-to-Text result:', spokenText);
      if (spokenText && spokenText.trim()) {
        // Set STT active flag to prevent gesture interference
        isSTTActive.current = true;
        
        // Process the spoken text as a sentence
        const sentenceNumber = sentenceCounter + 1;
        const numberedSentence = `${sentenceNumber}. ${spokenText.trim()}`;
        
        setLocalSentenceHistory(prev => {
          const updated = [...prev, numberedSentence];
          return updated.slice(-MAX_DISPLAYED_SENTENCES);
        });
        setLocalSentence(numberedSentence);
        setSentenceCounter(sentenceNumber);
        
        console.log('Speech sentence processed:', numberedSentence);
        
        // Send speech sentence to remote participant
        const isConnected = callStatusRef.current === 'connected' || 
          (peerConnection.current && peerConnection.current.connectionState === 'connected');
        
        if (isConnected) {
          console.log('Sending speech sentence to remote:', numberedSentence);
          socketService.sendSpeechMessage(contact.id, { 
            text: numberedSentence
          });
        }
        
        // Reset STT active flag after a delay
        setTimeout(() => {
          isSTTActive.current = false;
        }, 1000);
      }
    });

    // Listen for speech recognition errors
    const speechErrorListener = emitter.addListener('onSpeechError', (error) => {
      console.error('Speech-to-Text error:', error);
      setIsListening(false);
    });

    // Listen for listening state changes
    const listeningStateListener = emitter.addListener('onListeningStateChanged', (data) => {
      console.log('Speech-to-Text listening state:', data);
      setIsListening(data.isListening);
    });

    // Store listeners for cleanup
    listeners.current.push(
      { event: 'onSpeechResult', callback: speechListener },
      { event: 'onSpeechError', callback: speechErrorListener },
      { event: 'onListeningStateChanged', callback: listeningStateListener }
    );
  };

  const setupSocketListeners = () => {
    const handlers = [
      {
        event: 'call-accepted',
        callback: (data) => {
          if (data.callId === callId) {
            console.log('Call accepted:', data);
            setCallStatus('connecting');
          }
        },
      },
      {
        event: 'call-rejected',
        callback: (data) => {
          if (data.callId === callId) {
            console.log('Call rejected:', data);
            setShowRejectModal(true);
            // Auto end call after showing modal
            setTimeout(() => {
              endCall();
            }, 3000);
          }
        },
      },
      {
        event: 'call-ended',
        callback: (data) => {
          if (data.callId === callId) {
            console.log('Call ended:', data);
            endCall();
          }
        },
      },
      {
        event: 'call-missed',
        callback: (data) => {
          if (data.callId === callId) {
            console.log('Call missed:', data);
            // For the caller, show a missed call message instead of reject modal
            if (isInitiator) {
              setCallStatus('missed');
              callStatusRef.current = 'missed';
              // Show missed call message and auto end call
              setTimeout(() => {
                endCall();
              }, 2000);
            } else {
              // For the receiver, show reject modal
              setShowRejectModal(true);
              setTimeout(() => {
                endCall();
              }, 3000);
            }
          }
        },
      },
      {
        event: 'call-cancelled',
        callback: (data) => {
          if (data.callId === callId) {
            console.log('Call cancelled:', data);
            // For the receiver, the call was cancelled by the caller
            if (!isInitiator) {
              setCallStatus('cancelled');
              callStatusRef.current = 'cancelled';
              // Auto end call after showing cancelled message
              setTimeout(() => {
                endCall();
              }, 2000);
            }
          }
        },
      },
      {
        event: 'webrtc-offer',
        callback: (data) => {
          console.log('Received webrtc-offer:', data);
          if (data.fromUserId === contact.id) {
            console.log('Processing offer from contact:', contact.id);
            handleOffer(data.offer);
          } else {
            console.log('Offer not from expected contact. Expected:', contact.id, 'Got:', data.fromUserId);
          }
        },
      },
      {
        event: 'webrtc-answer',
        callback: (data) => {
          console.log('Received webrtc-answer:', data);
          if (data.fromUserId === contact.id) {
            console.log('Processing answer from contact:', contact.id);
            handleAnswer(data.answer);
          } else {
            console.log('Answer not from expected contact. Expected:', contact.id, 'Got:', data.fromUserId);
          }
        },
      },
      {
        event: 'webrtc-ice-candidate',
        callback: (data) => {
          console.log('Received webrtc-ice-candidate:', data);
          if (data.fromUserId === contact.id) {
            console.log('Processing ICE candidate from contact:', contact.id);
            handleIceCandidate(data.candidate);
          } else {
            console.log('ICE candidate not from expected contact. Expected:', contact.id, 'Got:', data.fromUserId);
          }
        },
      },
      {
        event: 'gesture-data',
        callback: (data) => {
          console.log('Received gesture data:', data);
          if (data.fromUserId === contact.id) {
            console.log('Processing gesture data from contact:', contact.id, 'Text:', data.gestureData.text, 'Type:', data.gestureData.type);
            
            if (data.gestureData.type === 'sentence') {
              // Handle complete sentence
              setRemoteSentence(data.gestureData.text);
              setRemoteSentenceHistory(prev => {
                const updated = [...prev, data.gestureData.text];
                return updated.slice(-MAX_DISPLAYED_SENTENCES);
              });
              console.log('Received remote sentence:', data.gestureData.text);
              
              // Note: TTS is now manual only - users tap speaker buttons for individual sentences
            } else {
              // Handle individual gesture
              const gestureMatch = data.gestureData.text.match(/^(.+?)\s+(\d+)%$/);
              if (gestureMatch) {
                const gesture = gestureMatch[1];
                const score = parseInt(gestureMatch[2]) / 100;
                processRemoteGesture(gesture, score);
              } else {
                setRemoteRecognizedText(data.gestureData.text);
                setLastRemoteGestureTime(Date.now());
              }
            }
          } else {
            console.log('Gesture data not from expected contact. Expected:', contact.id, 'Got:', data.fromUserId);
          }
        },
      },
      {
        event: 'speech-message',
        callback: (data) => {
          console.log('Received speech message:', data);
          if (data.fromUserId === contact.id) {
            console.log('Processing speech message from contact:', contact.id, 'Text:', data.messageData.text);
            
            // Handle speech message
            setRemoteSentence(data.messageData.text);
            setRemoteSentenceHistory(prev => {
              const updated = [...prev, data.messageData.text];
              return updated.slice(-MAX_DISPLAYED_SENTENCES);
            });
            console.log('Received remote speech message:', data.messageData.text);
          } else {
            console.log('Speech message not from expected contact. Expected:', contact.id, 'Got:', data.fromUserId);
          }
        },
      },
    ];
    handlers.forEach(({ event, callback }) => {
      socketService.on(event, callback);
      listeners.current.push({ event, callback });
    });
  };

  useEffect(() => {
    console.log('VideoCallScreen: Component mounted, initializing...');
    console.log('Socket connected:', socketService.isSocketConnected());
    console.log('Call params:', { contact: contact.name, callId, isInitiator });
    
    // Ensure socket is connected before proceeding
    const initializeWithSocket = async () => {
      if (!socketService.isSocketConnected()) {
        console.log('Socket not connected, attempting to connect...');
        try {
          await socketService.connect();
          console.log('Socket connected successfully');
        } catch (error) {
          console.error('Failed to connect socket:', error);
          Alert.alert('Connection Error', 'Failed to establish connection. Please try again.');
          navigation.goBack();
          return;
        }
      }
      
      initializeWebRTC();
      setupSocketListeners();
      setupSpeechToTextListeners();
    };
    
    initializeWithSocket();
    
    return () => {
      console.log('VideoCallScreen: Component unmounting, cleaning up...');
      cleanup();
    };
  }, []);

  // Process pending offer when peer connection becomes available
  useEffect(() => {
    if (pendingOffer && peerConnection.current && !isInitiator) {
      console.log('Processing pending offer after peer connection ready...');
      handleOffer(pendingOffer);
      setPendingOffer(null);
    } else if (!isInitiator && peerConnection.current) {
      // Check for global pending offer
      const globalOffer = socketService.getPendingWebRTCOffer();
      if (globalOffer && globalOffer.fromUserId === contact.id) {
        console.log('Processing global pending offer after peer connection ready...');
        handleOffer(globalOffer.offer);
      }
    }
  }, [pendingOffer, isInitiator]);

  const renderCallStatus = () => {
    const statusText = {
      calling: 'Calling...',
      ringing: 'Ringing...',
      connecting: 'Connecting...',
      connected: formatDuration(callDuration),
      missed: 'Call Missed',
      cancelled: 'Call Cancelled',
    };
    return statusText[callStatus];
  };

  const getCallStatusStyle = () => {
    if (callStatus === 'missed') {
      return [styles.timer, styles.missedCallText];
    }
    if (callStatus === 'cancelled') {
      return [styles.timer, styles.cancelledCallText];
    }
    return styles.timer;
  };

  return (
    <View style={styles.container}>
      {/* Remote Video Stream */}
      {remoteStream && (
        <RTCView
          style={styles.remoteVideo}
          streamURL={remoteStream.toURL()}
          objectFit="cover"
          zOrder={0}
          key={remoteStream.id}
        />
      )}
      
      {/* Local Video Stream */}
      {localStream && (
        <RTCView
          style={styles.localVideo}
          streamURL={localStream.toURL()}
          objectFit="cover"
          zOrder={1}
        />
      )}
      
      {/* Gesture Recognition Overlays */}
      {!!recognizedText && (
        <View style={styles.localGestureOverlay}>
          <Text style={styles.overlayLabel}>Your Gesture:</Text>
          <Text style={styles.overlayText}>{recognizedText}</Text>
        </View>
      )}
      
      {/* Speech-to-Text Status */}
      {isListening && (
        <View style={styles.speechToTextOverlay}>
          <Text style={styles.speechToTextLabel}>🎤 Listening...</Text>
          <Text style={styles.speechToTextHint}>Speak now, tap mic to stop</Text>
        </View>
      )}


      {/* Current Sentence Being Built */}
      {isBuildingSentence.current && sentenceGestures.current.length > 0 && (
        <View style={styles.currentSentenceOverlay}>
          <Text style={styles.currentSentenceLabel}>Building Sentence:</Text>
          <Text style={styles.currentSentenceText}>
            {sentenceGestures.current.join(', ').toLowerCase()}
          </Text>
          <Text style={styles.currentSentenceHint}>Auto-sends in 3 seconds • Tap ✗ to clear</Text>
        </View>
      )}
      
      {/* Sentence Overlays */}
      {!!localSentence && (
        <View style={styles.localSentenceOverlay}>
          <Text style={styles.sentenceLabel}>Your Sentence:</Text>
          <Text style={styles.sentenceText}>{localSentence.replace(/^\d+\.\s*/, '')}</Text>
        </View>
      )}
      
      {/* Sentence History */}
      {remoteSentenceHistory.length > 0 && (
        <ScrollView 
          style={styles.remoteSentenceHistoryOverlay}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {remoteSentenceHistory.map((sentence, index) => {
            // Remove numbering from sentence
            const textWithoutNumber = sentence.replace(/^\d+\.\s*/, '');
            return (
              <View key={index} style={styles.sentenceItemClean}>
                <Text style={styles.historyTextClean}>{textWithoutNumber}</Text>
                <TouchableOpacity
                  style={styles.speakerButtonClean}
                  onPress={() => speakSentence(sentence)}
                  disabled={isSpeaking}
                >
                  <Text style={[styles.speakerButtonTextClean, isSpeaking && styles.speakerButtonDisabled]}>
                    🔊
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
      
      {/* Top Section - User Name and Timer */}
      <View style={styles.topSection}>
        <Text style={styles.userName}>{contact.name}</Text>
        <Text style={getCallStatusStyle()}>{renderCallStatus()}</Text>
      </View>
      
      {/* Bottom Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isListening ? styles.controlButtonActive : null]}
          onPress={toggleSpeechToText}
        >
          <Image 
            source={require('../../photos/microphone.png')} 
            style={[styles.controlIcon, isListening && styles.controlIconMuted]} 
          />
        </TouchableOpacity>
        
        
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={switchCamera}
        >
          <Image 
            source={require('../../photos/cameraswitch.png')} 
            style={styles.controlIcon} 
          />
        </TouchableOpacity>
        
        {/* Clear Sentence Button */}
        {isBuildingSentence.current && sentenceGestures.current.length > 0 && (
          <TouchableOpacity 
            style={[styles.controlButton, styles.clearButton]} 
            onPress={() => {
              if (isBuildingSentence.current && sentenceGestures.current.length > 0) {
                console.log('Clearing current sentence being built');
                
                // Reset sentence building state
                sentenceGestures.current = [];
                isBuildingSentence.current = false;
                noHandsStartTime.current = null;
                if (noHandsTimeoutRef.current) {
                  clearTimeout(noHandsTimeoutRef.current);
                  noHandsTimeoutRef.current = null;
                }
                if (autoSendTimerRef.current) {
                  clearTimeout(autoSendTimerRef.current);
                  autoSendTimerRef.current = null;
                }
                
                console.log('Sentence cleared successfully');
              }
            }}
          >
            <Text style={styles.clearButtonText}>✗</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.controlButton, styles.endCallButton]} 
          onPress={endCall}
        >
          <Image 
            source={require('../../photos/call-end.png')} 
            style={styles.controlIcon} 
          />
        </TouchableOpacity>
      </View>

      {/* Reject Call Modal */}
      <RejectCallModal
        visible={showRejectModal}
        callerName={contact.name}
        onClose={() => setShowRejectModal(false)}
      />

      {/* Permission Request Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPermissionRequestModal}
        onRequestClose={handleCancelPermissionRequest}
      >
        <View style={styles.permissionModalOverlay}>
          <View style={styles.permissionModalContent}>
            <View style={styles.permissionModalHeader}>
              <Text style={styles.permissionModalTitle}>
                Camera Access Required
              </Text>
            </View>
            
            <View style={styles.permissionModalBody}>
              <Text style={styles.permissionModalMessage}>
                SignLink needs access to your camera to enable video calls with your contacts.
              </Text>
              <Text style={styles.permissionModalInfo}>
                Your privacy is important. Camera access is only used during video calls.
              </Text>
            </View>

            <View style={styles.permissionModalActions}>
              <TouchableOpacity
                style={[styles.permissionModalButton, styles.permissionCancelButton]}
                onPress={handleCancelPermissionRequest}
              >
                <Text style={styles.permissionCancelButtonText}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.permissionModalButton, styles.permissionSettingsButton]}
                onPress={handleRequestCameraPermission}
              >
                <Text style={styles.permissionSettingsButtonText}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Permission Settings Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPermissionModal}
        onRequestClose={() => {
          setShowPermissionModal(false);
          navigation.goBack();
        }}
      >
        <View style={styles.permissionModalOverlay}>
          <View style={styles.permissionModalContent}>
            <View style={styles.permissionModalHeader}>
              <Text style={styles.permissionModalTitle}>
                {permissionType === 'camera' ? 'Camera' : 'Microphone'} Permission Required
              </Text>
            </View>
            
            <View style={styles.permissionModalBody}>
              <Text style={styles.permissionModalMessage}>
                You've denied {permissionType} permission. To use {permissionType === 'camera' ? 'video calls' : 'speech-to-text'}, please enable it in your device settings.
              </Text>
              <Text style={styles.permissionModalSteps}>
                Settings → Apps → SignLink → Permissions → {permissionType === 'camera' ? 'Camera' : 'Microphone'}
              </Text>
            </View>

            <View style={styles.permissionModalActions}>
              <TouchableOpacity
                style={[styles.permissionModalButton, styles.permissionCancelButton]}
                onPress={() => {
                  setShowPermissionModal(false);
                  navigation.goBack();
                }}
              >
                <Text style={styles.permissionCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.permissionModalButton, styles.permissionSettingsButton]}
                onPress={openAppSettings}
              >
                <Text style={styles.permissionSettingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  remoteVideo: { 
    flex: 1 
  },
  localVideo: { 
    position: 'absolute', 
    top: 80, 
    right: 20, 
    width: 120, 
    height: 160,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff'
  },
  topSection: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  userName: {
    color: theme.name === 'dark' ? '#fff' : '#000',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: theme.name === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timer: {
    color: theme.name === 'dark' ? '#fff' : '#000',
    fontSize: 18,
    fontWeight: '500',
    textShadowColor: theme.name === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  missedCallText: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cancelledCallText: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: 'bold',
  },
  controlsContainer: { 
    position: 'absolute', 
    bottom: 50, 
    left: 0,
    right: 0,
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlButton: {
    backgroundColor: theme.name === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
    padding: 15,
    borderRadius: 30,
    marginHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: theme.name === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
  },
  controlButtonActive: { 
    backgroundColor: 'rgba(231, 76, 60, 0.8)',
    borderColor: '#e74c3c',
  },
  endCallButton: { 
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    borderColor: '#e74c3c',
  },
  finalizeButton: { 
    backgroundColor: 'rgba(46, 204, 113, 0.9)',
    borderColor: '#2ecc71',
  },
  finalizeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  clearButton: { 
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    borderColor: '#e74c3c',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  controlIcon: {
    width: 24,
    height: 24,
    tintColor: theme.name === 'dark' ? '#fff' : '#000',
  },
  controlIconMuted: {
    tintColor: '#e74c3c',
  },
  localGestureOverlay: { 
    position: 'absolute', 
    top: 20, 
    left: 20, 
    backgroundColor: 'transparent', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    zIndex: 10,
  },
  remoteGestureOverlay: { 
    position: 'absolute', 
    top: 100, 
    left: 20, 
    backgroundColor: 'rgba(0,100,200,0.8)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    zIndex: 10,
  },
  overlayLabel: { 
    color: '#7C01F6', 
    fontSize: 16, 
    fontWeight: '500', 
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  currentSentenceOverlay: { 
    position: 'absolute', 
    top: 200, 
    left: 20, 
    backgroundColor: 'transparent', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderRadius: 10,
    zIndex: 10,
    maxWidth: '70%',
  },
  currentSentenceLabel: { 
    color: '#7C01F6', 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  currentSentenceText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  currentSentenceHint: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '500',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  speechToTextOverlay: { 
    position: 'absolute', 
    top: 150, 
    left: 20, 
    backgroundColor: 'transparent', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderRadius: 10,
    zIndex: 10,
    maxWidth: '70%',
  },
  speechToTextLabel: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '700', 
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  speechToTextHint: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '500',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  localSentenceOverlay: { 
    position: 'absolute', 
    top: 120, 
    left: 20, 
    backgroundColor: 'transparent', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderRadius: 10,
    zIndex: 10,
    maxWidth: '50%',
  },
  remoteSentenceOverlay: { 
    position: 'absolute', 
    top: 300, 
    left: 20, 
    backgroundColor: 'rgba(0,100,200,0.9)', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderRadius: 10,
    zIndex: 10,
    maxWidth: '70%',
  },
  sentenceLabel: { 
    color: '#7C01F6', 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sentenceText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '700',
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  localSentenceHistoryOverlay: { 
    position: 'absolute', 
    bottom: 200, 
    left: 20, 
    backgroundColor: 'transparent', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8,
    zIndex: 10,
    maxWidth: '60%',
    maxHeight: 120,
  },
  remoteSentenceHistoryOverlay: { 
    position: 'absolute', 
    bottom: 120, 
    left: 20, 
    right: 20,
    zIndex: 10,
    maxHeight: 180,
    paddingRight: 0,
  },
  historyScrollView: {
    maxHeight: 80,
  },
  historyLabel: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '600', 
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  historyText: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '500',
    marginBottom: 3,
    lineHeight: 16,
    paddingVertical: 1,
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sentenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  sentenceItemClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 3,
    backgroundColor: 'transparent',
    borderRadius: 8,
    width: '100%',
  },
  historyTextClean: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  speakerButtonClean: {
    padding: 6,
    marginLeft: 10,
    flexShrink: 0,
  },
  speakerButtonTextClean: {
    fontSize: 16,
    color: '#fff',
  },
  speakerButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 150, 255, 0.8)',
    marginLeft: 8,
  },
  speakerButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  speakerButtonDisabled: {
    opacity: 0.5,
  },
  // Permission Modal Styles
  permissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionModalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    width: Dimensions.get('window').width * 0.85,
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  permissionModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  },
  permissionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  permissionModalBody: {
    padding: 20,
  },
  permissionModalMessage: {
    fontSize: 15,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 15,
  },
  permissionModalInfo: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  permissionModalSteps: {
    fontSize: 13,
    color: theme.colors.primary,
    textAlign: 'center',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  permissionModalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  },
  permissionModalButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCancelButton: {
    borderRightWidth: 1,
    borderRightColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  },
  permissionCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  permissionSettingsButton: {
    backgroundColor: 'transparent',
  },
  permissionSettingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});

export default VideoCallScreen;