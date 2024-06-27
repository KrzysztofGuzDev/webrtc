import React, { useEffect, useState, useRef } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import TextInputContainer from './components/TextInputContainer';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCView,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';
import CallEnd from './asset/CallEnd';
import CallAnswer from './asset/CallAnswer';
import MicOn from './asset/MicOn';
import MicOff from './asset/MicOff';
import VideoOn from './asset/VideoOn';
import VideoOff from './asset/VideoOff';
import CameraSwitch from './asset/CameraSwitch';
import IconContainer from './components/IconContainer';
import InCallManager from 'react-native-incall-manager';

export default function App({}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [type, setType] = useState('JOIN');
  const [localMicOn, setLocalMicOn] = useState(true);
  const [localWebcamOn, setLocalWebcamOn] = useState(true);

  const callerId = 'voicehealth-staging-contact-1';
  const otherUserId = useRef('room-test-hm');
  const sessionId = SessionManager.getSessionId();

  const peerConnection = useRef(
    new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: 'stun:stun1.l.google.com:19302',
        },
        {
          urls: 'stun:stun2.l.google.com:19302',
        },
      ],
    })
  );

  let remoteRTCMessage = useRef(null);

  console.log('Connecting to signaling server...');
  const socket = useRef(null);

  useEffect(() => {
    socket.current = new WebSocket('wss://alexa-vhcare.hmdev.org/ws');

    socket.current.onopen = () => {
      console.log('Connected to signaling server');
    };

    socket.current.onclose = (event) => {
      console.log('Disconnected from signaling server:', event.reason);
    };

    socket.current.onerror = (error) => {
      console.error('Connection error:', error);
    };

    socket.current.onmessage = (event) => {
      try {
        const data = event.data;
        console.log('DATA BEFORE PARSE', data);
    
        // Ensure data is a string before parsing
        let message;
        if (typeof data === 'string') {
          message = JSON.parse(data);
          ;
        } else {
          console.error('Received unexpected data format:', data);
          return;
        }
    
        if (!message) {
          console.error('Invalid WebSocket message:', data);
          return;
        }
    
        console.log('Parsed message:', message);
    
        if (message.type === 'newCall') {
          console.log('New call received:', message);
          remoteRTCMessage.current = message;
          otherUserId.current = message.callerId;
          setType('INCOMING_CALL');
        } else if (message.type === 'answer') {
          console.log('Call answered:', message);
          if (message.sdp && message.type) {
            remoteRTCMessage.current = message;
            const sessionDescription = new RTCSessionDescription({
              sdp: message.sdp,
              type: message.type,
            });
            peerConnection.current.setRemoteDescription(sessionDescription)
              .then(() => {
                console.log('Remote description set successfully');
                setType('WEBRTC_ROOM');
              })
              .catch((error) => {
                console.error('Error setting remote description:', error);
              });
          } else {
            console.error('RTC message missing sdp or type:', message);
          }
        } else if (message.type === 'ICEcandidate') {
          console.log('ICE candidate received:', message);
    
          if (message.candidate && message.sdpMid && message.sdpMLineIndex !== null) {
            peerConnection.current
              .addIceCandidate(
                new RTCIceCandidate({
                  candidate: message.candidate,
                  sdpMid: message.sdpMid,
                  sdpMLineIndex: message.sdpMLineIndex,
                })
              )
              .then(() => {
                console.log('Successfully added ICE candidate');
              })
              .catch((err) => {
                console.log('Error adding ICE candidate', err);
              });
          } else {
            console.error('Invalid ICE candidate message:', message);
          }
        } else {
          console.error('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to process onmessage event:', error);
      }
    };
    
    
    

    function parseWebSocketMessage(data) {
      try {
        // Ensure the data is treated as a string and parse it as JSON
        const message = JSON.parse(data);
        console.log('Parsed message data:', message);
    
        let { type, rtcMessage } = message;
    
        // If rtcMessage is a string, parse it again
        if (typeof rtcMessage === 'string') {
          try {
            rtcMessage = JSON.parse(rtcMessage);
          } catch (error) {
            console.error('Failed to parse nested rtcMessage:', error);
            rtcMessage = null;
          }
        }
    
        if (rtcMessage && typeof rtcMessage === 'object') {
          const {
            sdp = null,
            sessionId = null,
            candidate = null,
            id: sdpMid = null,
            label: sdpMLineIndex = null,
            error = null
          } = rtcMessage;
    
          return {
            type,
            sdp,
            sessionId,
            candidate,
            sdpMid,
            sdpMLineIndex,
            error
          };
        } else {
          console.error('Invalid rtcMessage format:', rtcMessage);
          return {
            type,
            sdp: null,
            sessionId: null,
            candidate: null,
            sdpMid: null,
            sdpMLineIndex: null,
            error: null
          };
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        return null;
      }
    }
    
    
    
    // function parseRTCMessage(rtcMessage) {
    //   try {
    //     if (rtcMessage) {
    //       const message = JSON.parse(rtcMessage);
    //       if (message && message.sdp && message.type) {
    //         return message;
    //       }
    //     }
    //   } catch (error) {
    //     console.error('Failed to parse RTC message:', error);
    //   }
    //   return null;
    // }
    
    
    
    

    let isFront = false;

    mediaDevices.enumerateDevices().then((sourceInfos) => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind == 'videoinput' &&
          sourceInfo.facing == (isFront ? 'user' : 'environment')
        ) {
          videoSourceId = sourceInfo.deviceId;
        }
      }

      mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            mandatory: {
              minWidth: 500,
              minHeight: 300,
              minFrameRate: 30,
            },
            facingMode: isFront ? 'user' : 'environment',
            optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
          },
        })
        .then((stream) => {
          console.log('Local stream obtained:', stream);
          setLocalStream(stream);
          peerConnection.current.addStream(stream);
        })
        .catch((error) => {
          console.log('Error getting user media:', error);
        });
    });

    peerConnection.current.onaddstream = (event) => {
      console.log('Remote stream added:', event.stream);
      setRemoteStream(event.stream);
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        sendICEcandidate({
          calleeId: otherUserId.current,
          rtcMessage: {
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            target: 'room-test-hm',
            source: 'voicehealth-staging-contact-1',
            sessionId: sessionId,
          },
        });
      } else {
        console.log('End of candidates.');
      }
    };

    return () => {
      socket.current.close();
    };
  }, []);

  useEffect(() => {
    InCallManager.start();
    InCallManager.setKeepScreenOn(true);
    InCallManager.setForceSpeakerphoneOn(true);

    return () => {
      InCallManager.stop();
    };
  }, []);

  function sendICEcandidate(data) {
    console.log('Sending ICE candidate:', data);
    socket.current.send(JSON.stringify({ type: 'ICEcandidate', data }));
  }

  function sendMessage(message) {
    console.log('Sending message:', message);
    socket.current.send(JSON.stringify(message));
  }

  function sendRegistration(userId, sessionId) {
    let message = {
      type: 'register',
      id: 'voicehealth-staging-contact-1',
      alexaRegion: 'NA',
      sessionId: sessionId,
    };
    console.log('Sending registration message:', message);
    socket.current.send(JSON.stringify(message));
  }

  async function processCall() {
    console.log('Creating offer...');
    const sessionDescription = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(sessionDescription);
    const offerMessage = {
      type: 'offer',
      sessionId: sessionId,
      sdp: sessionDescription.sdp,
      target: 'room-test-hm',
      source: 'voicehealth-staging-contact-1',
      alexaRegion: 'NA',
      id: 'voicehealth-staging-contact-1',
    };
    console.log('Sending offer message:', offerMessage);
    socket.current.send(JSON.stringify(offerMessage));
  }

  async function processAccept() {
    console.log('Processing accept...');
    const sessionDescription = new RTCSessionDescription({
      sdp: remoteRTCMessage.current.sdp,
      type: 'offer', // Assuming the type is 'offer'
    });
    await peerConnection.current.setRemoteDescription(sessionDescription);
    const answerDescription = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answerDescription);
    const answerMessage = {
      callerId: otherUserId.current,
      rtcMessage: {
        sdp: answerDescription.sdp,
        type: answerDescription.type,
      },
    };
    console.log('Sending answer message:', answerMessage);
    answerCall(answerMessage);
  }
  

  function answerCall(data) {
    console.log('Answering call with data:', data);
    socket.current.send(JSON.stringify({ type: 'answerCall', data }));
  }

  function sendCall(data) {
    console.log('Sending call with data:', data);
    socket.current.send(JSON.stringify(data));
  }

  const JoinScreen = () => {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          backgroundColor: '#050A0E',
          justifyContent: 'center',
          paddingHorizontal: 42,
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <>
            <View
              style={{
                padding: 35,
                backgroundColor: '#1A1C22',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  color: '#D0D4DD',
                }}
              >
                Your Caller ID
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 12,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 32,
                    color: '#ffff',
                    letterSpacing: 6,
                  }}
                >
                  {callerId}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: '#1A1C22',
                padding: 40,
                marginTop: 25,
                justifyContent: 'center',
                borderRadius: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  color: '#D0D4DD',
                }}
              >
                Enter call id of another user
              </Text>
              <TextInputContainer
                placeholder={'Enter Caller ID'}
                value={'room-test-hm'}
                setValue={(text) => {
                  otherUserId.current = text;
                  console.log('Updated otherUserId:', otherUserId.current);
                }}
                keyboardType={'number-pad'}
              />
              <TouchableOpacity
                onPress={() => {
                  setType('OUTGOING_CALL');
                  processCall();
                }}
                style={{
                  height: 50,
                  backgroundColor: '#5568FE',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 12,
                  marginTop: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#FFFFFF',
                  }}
                >
                  Call Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  sendRegistration('voicehealth-staging-contact-1', '421421444');
                }}
                style={{
                  height: 50,
                  backgroundColor: '#5568FE',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 12,
                  marginTop: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#FFFFFF',
                  }}
                >
                  Register
                </Text>
              </TouchableOpacity>
            </View>
          </>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  };

  const OutgoingCallScreen = () => {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'space-around',
          backgroundColor: '#050A0E',
        }}
      >
        <View
          style={{
            padding: 35,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: '#D0D4DD',
            }}
          >
            Calling to...
          </Text>

          <Text
            style={{
              fontSize: 36,
              marginTop: 12,
              color: '#ffff',
              letterSpacing: 6,
            }}
          >
            {otherUserId.current}
          </Text>
        </View>
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setType('JOIN');
              otherUserId.current = null;
            }}
            style={{
              backgroundColor: '#FF5D5D',
              borderRadius: 30,
              height: 60,
              aspectRatio: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <CallEnd width={50} height={12} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const IncomingCallScreen = () => {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'space-around',
          backgroundColor: '#050A0E',
        }}
      >
        <View
          style={{
            padding: 35,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              fontSize: 36,
              marginTop: 12,
              color: '#ffff',
            }}
          >
            {otherUserId.current} is calling..
          </Text>
        </View>
        <View
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => {
              processAccept();
              setType('WEBRTC_ROOM');
            }}
            style={{
              backgroundColor: 'green',
              borderRadius: 30,
              height: 60,
              aspectRatio: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <CallAnswer height={28} fill={'#fff'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  function switchCamera() {
    localStream.getVideoTracks().forEach((track) => {
      console.log('Switching camera...');
      track._switchCamera();
    });
  }

  function toggleCamera() {
    localWebcamOn ? setLocalWebcamOn(false) : setLocalWebcamOn(true);
    localStream.getVideoTracks().forEach((track) => {
      console.log('Toggling camera:', localWebcamOn ? 'off' : 'on');
      localWebcamOn ? (track.enabled = false) : (track.enabled = true);
    });
  }

  function toggleMic() {
    localMicOn ? setLocalMicOn(false) : setLocalMicOn(true);
    localStream.getAudioTracks().forEach((track) => {
      console.log('Toggling mic:', localMicOn ? 'off' : 'on');
      localMicOn ? (track.enabled = false) : (track.enabled = true);
    });
  }

  function leave() {
    console.log('Leaving the call...');
    peerConnection.current.close();
    setLocalStream(null);
    setType('JOIN');
  }

  const WebrtcRoomScreen = () => {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#050A0E',
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        {localStream ? (
          <RTCView
            objectFit={'cover'}
            style={{ flex: 1, backgroundColor: '#050A0E' }}
            streamURL={localStream.toURL()}
          />
        ) : null}
        {remoteStream ? (
          <RTCView
            objectFit={'cover'}
            style={{
              flex: 1,
              backgroundColor: '#050A0E',
              marginTop: 8,
            }}
            streamURL={remoteStream.toURL()}
          />
        ) : null}
        <View
          style={{
            marginVertical: 12,
            flexDirection: 'row',
            justifyContent: 'space-evenly',
          }}
        >
          <IconContainer
            backgroundColor={'red'}
            onPress={() => {
              leave();
            }}
            Icon={() => {
              return <CallEnd height={26} width={26} fill="#FFF" />;
            }}
          />
          <IconContainer
            style={{
              borderWidth: 1.5,
              borderColor: '#2B3034',
            }}
            backgroundColor={!localMicOn ? '#fff' : 'transparent'}
            onPress={() => {
              toggleMic();
            }}
            Icon={() => {
              return localMicOn ? (
                <MicOn height={24} width={24} fill="#FFF" />
              ) : (
                <MicOff height={28} width={28} fill="#1D2939" />
              );
            }}
          />
          <IconContainer
            style={{
              borderWidth: 1.5,
              borderColor: '#2B3034',
            }}
            backgroundColor={!localWebcamOn ? '#fff' : 'transparent'}
            onPress={() => {
              toggleCamera();
            }}
            Icon={() => {
              return localWebcamOn ? (
                <VideoOn height={24} width={24} fill="#FFF" />
              ) : (
                <VideoOff height={36} width={36} fill="#1D2939" />
              );
            }}
          />
          <IconContainer
            style={{
              borderWidth: 1.5,
              borderColor: '#2B3034',
            }}
            backgroundColor={'transparent'}
            onPress={() => {
              switchCamera();
            }}
            Icon={() => {
              return <CameraSwitch height={24} width={24} fill="#FFF" />;
            }}
          />
        </View>
      </View>
    );
  };

  switch (type) {
    case 'JOIN':
      return JoinScreen();
    case 'INCOMING_CALL':
      return IncomingCallScreen();
    case 'OUTGOING_CALL':
      return OutgoingCallScreen();
    case 'WEBRTC_ROOM':
      return WebrtcRoomScreen();
    default:
      return null;
  }
}

const SessionManager = (function () {
  let sessionId = null;

  function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  return {
    getSessionId: function () {
      if (!sessionId) {
        sessionId = generateSessionId();
      }
      return sessionId;
    },
  };
})();
