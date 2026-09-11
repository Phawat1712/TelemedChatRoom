import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  PermissionsAndroid,
  Image,
  Linking,
  Animated,
} from 'react-native';
import * as signalR from '@microsoft/signalr';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { chatConnection } from '../services/chatSignalR';
import { pick, types } from '@react-native-documents/picker';

import Sound from 'react-native-nitro-sound';
type Message = {
  messageID: number;
  conversationID: number;
  senderUserID: number;
  messageType: number;
  message: string | null;
  createdDate: string;
  readDate?: string | null;
  fileName?: string;
  fileURL?: string;
  fileType?: string;
  fileSize?: number;
};

type Props = {
  conversationID: number;
  currentUserID: number;
  targetUserID: number;
  onBack: () => void;
};

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),

          Animated.timing(animatedValue, {
            toValue: -5,
            duration: 250,
            useNativeDriver: true,
          }),

          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),

          Animated.delay(400 - delay),
        ]),
      );
    };

    const animation1 = animateDot(dot1, 0);
    const animation2 = animateDot(dot2, 120);
    const animation3 = animateDot(dot3, 240);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        marginHorizontal: 16,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 18,
          borderBottomLeftRadius: 5,

          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: {
            width: 0,
            height: 2,
          },

          elevation: 2,
        }}
      >
        {[dot1, dot2, dot3].map((dot, index) => (
          <Animated.View
            key={index}
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: '#999',
              marginHorizontal: 2,
              transform: [
                {
                  translateY: dot,
                },
              ],
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function ChatScreen({
  conversationID,
  currentUserID,
  targetUserID,
  onBack,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList<Message>>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [playingMessageID, setPlayingMessageID] = useState<number | null>(null);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isTargetTyping, setIsTargetTyping] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTypingSentRef = useRef(false);
  useEffect(() => {
    const initChat = async () => {
      await loadMessages();
      await markAsRead();
    };

    initChat();
  }, [conversationID]);

  useEffect(() => {
    const backAction = () => {
      onBack();

      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => {
      subscription.remove();
    };
  }, [onBack]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    const connectSignalR = async () => {
      try {
        if (chatConnection.state === signalR.HubConnectionState.Disconnected) {
          await chatConnection.start();

          console.log('SignalR connected');
        }

        await chatConnection.invoke('JoinConversation', conversationID);

        console.log('Join conversation:', conversationID);
      } catch (error) {
        console.log('SignalR error:', error);
      }
    };

    const handleReceiveMessage = async (message: Message) => {
      console.log('ReceiveMessage:', message);

      if (message.messageType === 1) {
        setMessages(prev => {
          const exists = prev.some(x => x.messageID === message.messageID);

          if (exists) {
            return prev;
          }

          return [...prev, message];
        });
      } else {
        // image / file / voice
        await loadMessages();
      }

      // ถ้าเป็นข้อความที่อีกฝ่ายส่งมา
      // และเรากำลังอยู่ในห้องนี้
      if (message.senderUserID !== currentUserID) {
        await markAsRead();
      }
    };

    const handleMessagesRead = (data: {
      conversationID: number;
      readerUserID: number;
      messageIDs: number[];
      readDate: string;
    }) => {
      console.log('MessagesRead:', data);

      setMessages(prev =>
        prev.map(message =>
          data.messageIDs.includes(message.messageID)
            ? {
                ...message,
                readDate: data.readDate,
              }
            : message,
        ),
      );
    };

    const handleUserTypeing = (data: {
      conversationID: number;
      userID: number;
      isTyping: boolean;
    }) => {
      console.log('UserTyping:', data);

      if (
        data.conversationID === conversationID &&
        data.userID === targetUserID
      ) {
        setIsTargetTyping(data.isTyping);
      }
    };

    chatConnection.on('ReceiveMessage', handleReceiveMessage);

    chatConnection.on('MessagesRead', handleMessagesRead);

    chatConnection.on('UserTyping', handleUserTypeing);

    connectSignalR();

    return () => {
      chatConnection.off('ReceiveMessage', handleReceiveMessage);

      chatConnection.off('MessagesRead', handleMessagesRead);

      chatConnection.off('UserTyping', handleUserTypeing);

      if (chatConnection.state === signalR.HubConnectionState.Connected) {
        chatConnection
          .invoke('LeaveConversation', conversationID)
          .catch(error => {
            console.log('Leave conversation error:', error);
          });
      }
    };
  }, [conversationID, currentUserID, targetUserID]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    });

    return () => {
      showSubscription.remove();
    };
  }, []);

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `http://119.59.114.31:9060/chat/GetMessages?conversationID=${conversationID}`,
      );

      const result = await response.json();

      console.log('GetMessages:', result);

      if (result.success) {
        setMessages(result.data ?? []);
      }
    } catch (error) {
      console.log('GetMessages error:', error);
    }
  };

  const handleSend = async () => {
    if (!text.trim()) {
      return;
    }

    console.log('1. กดส่งแล้ว');

    try {
      const response = await fetch('http://119.59.114.31:9060/Chat/Send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationID: conversationID,
          senderUserID: currentUserID,
          messageType: 1,
          message: text.trim(),
        }),
      });

      console.log('2. status:', response.status);

      const result = await response.json();

      console.log('3. Send result:', result);

      if (result.success) {
        console.log('4. ส่งสำเร็จ');
        setText('');
      } else {
        console.log('ส่งไม่สำเร็จ:', result.message);
      }
    } catch (error) {
      console.log('Send error:', error);
    }
  };

  const uploadFile = async (file: {
    uri: string;
    name: string;
    type: string;
  }) => {
    try {
      const formData = new FormData();

      formData.append('ConversationID', conversationID.toString());

      formData.append('SenderUserID', currentUserID.toString());

      formData.append('File', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

      console.log('Upload file:', file);

      const response = await fetch('http://119.59.114.31:9060/Chat/SendFile', {
        method: 'POST',

        // ห้ามใส่ Content-Type multipart/form-data เอง
        body: formData,
      });

      const result = await response.json();

      console.log('SendFile result:', result);

      if (!result.success) {
        Alert.alert('ส่งไฟล์ไม่สำเร็จ', result.message ?? 'เกิดข้อผิดพลาด');

        return;
      }

      console.log('ส่งไฟล์สำเร็จ');
    } catch (error) {
      console.log('Upload file error:', error);

      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถส่งไฟล์ได้');
    }
  };

  const handlePickFile = async () => {
    try {
      const files = await pick({
        type: [types.images, types.pdf, types.audio],
        allowMultiSelection: false,
      });

      if (!files.length) {
        return;
      }

      const file = files[0];

      console.log('Picked file:', file);

      await uploadFile({
        uri: file.uri,
        name: file.name ?? `file_${Date.now()}`,
        type: file.type ?? 'application/octet-stream',
      });
    } catch (error: any) {
      console.log('Pick file error:', error);
    }
  };

  const requestMicrophonePermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'อนุญาตใช้ไมโครโฟน',
        message: 'ChatRoom ต้องการใช้ไมโครโฟนเพื่อส่งข้อความเสียง',
        buttonPositive: 'อนุญาต',
        buttonNegative: 'ยกเลิก',
      },
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handleStartRecording = async () => {
    try {
      const hasPermission = await requestMicrophonePermission();

      if (!hasPermission) {
        Alert.alert(
          'ไม่สามารถเริ่มบันทึกเสียงได้',
          'โปรดอนุญาตการเข้าถึงไมโครโฟน',
        );

        return;
      }

      const uri = await Sound.startRecorder();

      console.log('Recording URI:', uri);

      Sound.addRecordBackListener((e: any) => {
        setRecordTime(Sound.mmssss(Math.floor(e.currentPosition)));
      });

      setIsRecording(true);
    } catch (error) {
      console.log('Start record error:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      const uri = await Sound.stopRecorder();

      Sound.removeRecordBackListener();

      setIsRecording(false);
      setRecordTime('00:00');

      console.log('Audio URI:', uri);

      if (!uri) {
        return;
      }

      const fileName = `voice_${Date.now()}.m4a`;

      const mimeType = 'audio/mp4';

      await uploadFile({
        uri,
        name: fileName,
        type: mimeType,
      });
    } catch (error) {
      console.log('Stop record error:', error);

      setIsRecording(false);
    }
  };

  const handlePlayAudio = async (item: Message) => {
    if (!item.fileURL) {
      return;
    }

    try {
      // ถ้ากดเสียงเดิมตอนกำลังเล่นอยู่ = หยุด
      if (playingMessageID === item.messageID) {
        await Sound.stopPlayer();
        Sound.removePlayBackListener();

        setPlayingMessageID(null);
        setAudioPosition(0);
        setAudioDuration(0);

        return;
      }

      // ถ้ามีเสียงอื่นเล่นอยู่ ให้หยุดก่อน
      await Sound.stopPlayer().catch(() => {});
      Sound.removePlayBackListener();

      const url = `http://119.59.114.31:9060${item.fileURL}`;

      await Sound.startPlayer(url);

      setPlayingMessageID(item.messageID);

      Sound.addPlayBackListener((e: any) => {
        setAudioPosition(e.currentPosition ?? 0);
        setAudioDuration(e.duration ?? 0);

        if (e.duration > 0 && e.currentPosition >= e.duration) {
          Sound.stopPlayer();
          Sound.removePlayBackListener();

          setPlayingMessageID(null);
          setAudioPosition(0);
          setAudioDuration(0);
        }
      });
    } catch (error) {
      console.log('Play audio error:', error);

      setPlayingMessageID(null);
      setAudioPosition(0);
      setAudioDuration(0);
    }
  };

  const formatAudioTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderMessageContent = (item: Message, isMe: boolean) => {
    switch (item.messageType) {
      case 1:
        return (
          <Text
            style={{
              color: isMe ? '#FFFFFF' : '#333333',
              fontSize: 15,
              lineHeight: 21,
            }}
          >
            {item.message}
          </Text>
        );

      case 2:
        return (
          <Image
            source={{
              uri: `http://119.59.114.31:9060${item.fileURL}`,
            }}
            style={{
              width: 220,
              height: 220,
              borderRadius: 12,
            }}
            resizeMode="cover"
          />
        );

      case 3:
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleOpenFile(item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              maxWidth: 230,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#FFF0F5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={25}
                color={isMe ? '#FFFFFF' : '#F43879'}
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 10,
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isMe ? '#FFFFFF' : '#333333',
                }}
              >
                {item.fileName ?? 'ไฟล์'}
              </Text>

              <Text
                style={{
                  fontSize: 11,
                  marginTop: 3,
                  color: isMe ? 'rgba(255,255,255,0.75)' : '#999999',
                }}
              >
                แตะเพื่อเปิดไฟล์
              </Text>
            </View>

            <Ionicons
              name="open-outline"
              size={20}
              color={isMe ? '#FFFFFF' : '#F43879'}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        );

      case 4: {
        const isPlaying = playingMessageID === item.messageID;

        const progress =
          isPlaying && audioDuration > 0
            ? Math.min(audioPosition / audioDuration, 1)
            : 0;

        return (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handlePlayAudio(item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: 230,
            }}
          >
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={34}
              color={isMe ? '#FFFFFF' : '#F43879'}
            />

            <View
              style={{
                flex: 1,
                marginLeft: 10,
              }}
            >
              <View
                style={{
                  height: 4,
                  borderRadius: 4,
                  overflow: 'hidden',
                  backgroundColor: isMe ? 'rgba(255,255,255,0.35)' : '#F3C4D4',
                }}
              >
                <View
                  style={{
                    width: `${progress * 100}%`,
                    height: '100%',
                    backgroundColor: isMe ? '#FFFFFF' : '#F43879',
                  }}
                />
              </View>

              <Text
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  color: isMe ? 'rgba(255,255,255,0.9)' : '#888',
                }}
              >
                {isPlaying
                  ? `${formatAudioTime(audioPosition)} / ${formatAudioTime(
                      audioDuration,
                    )}`
                  : 'ข้อความเสียง'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }
      default:
        return null;
    }
  };

  const handleOpenFile = async (item: Message) => {
    if (!item.fileURL) {
      Alert.alert('ไม่พบไฟล์', 'ไม่พบ URL ของไฟล์นี้');
      return;
    }

    try {
      const url = `http://119.59.114.31:9060${item.fileURL}`;

      console.log('Open file:', url);

      await Linking.openURL(url);
    } catch (error) {
      console.log('Open file error:', error);

      Alert.alert('เปิดไฟล์ไม่สำเร็จ', 'ไม่สามารถเปิดไฟล์นี้ได้');
    }
  };

  const markAsRead = async () => {
    try {
      const response = await fetch(
        'http://119.59.114.31:9060/Chat/MarkAsRead',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationID,
            userID: currentUserID,
          }),
        },
      );

      const result = await response.json();

      console.log('MarkAsRead:', result);
    } catch (error) {
      console.log('MarkAsRead error:', error);
    }
  };
  const handleTextChange = (value: string) => {
    setText(value);

    if (!isTypingSentRef.current && value.length > 0) {
      isTypingSentRef.current = true;

      chatConnection
        .invoke('Typing', conversationID, currentUserID, true)
        .catch(error => {
          console.log('Typing true error:', error);
        });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingSentRef.current) {
        isTypingSentRef.current = false;

        chatConnection
          .invoke('Typing', conversationID, currentUserID, false)
          .catch(error => {
            console.log('Typing false error:', error);
          });
      }
    }, 1200);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#FFF7FA' }}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, backgroundColor: '#FFF7FA' }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: '#FFFFFF',
              borderBottomWidth: 1,
              borderBottomColor: '#F3D4DF',
            }}
          >
            <TouchableOpacity
              onPress={onBack}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 4,
              }}
            >
              <Ionicons name="chevron-back" size={26} color="#F43879" />
            </TouchableOpacity>

            <View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: '#333',
                }}
              >
                ห้องแชท
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  color: '#999',
                  marginTop: 2,
                }}
              >
                Conversation #{conversationID}
              </Text>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyboardShouldPersistTaps="always"
            keyExtractor={item => item.messageID.toString()}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 18,
            }}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({
                animated: false,
              });
            }}
            renderItem={({ item }) => {
              const isMe = item.senderUserID === currentUserID;

              return (
                <View
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '78%',
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      backgroundColor:
                        item.messageType === 2
                          ? 'transparent'
                          : isMe
                          ? '#F43879'
                          : '#FFFFFF',

                      borderRadius: item.messageType === 2 ? 0 : 18,

                      borderBottomRightRadius:
                        item.messageType === 2 ? 0 : isMe ? 4 : 18,

                      borderBottomLeftRadius:
                        item.messageType === 2 ? 0 : isMe ? 18 : 4,

                      paddingHorizontal: item.messageType === 2 ? 0 : 14,
                      paddingVertical: item.messageType === 2 ? 0 : 10,

                      shadowColor: '#000',
                      shadowOpacity: item.messageType === 2 ? 0 : 0.04,
                      shadowRadius: 4,
                      shadowOffset: {
                        width: 0,
                        height: 2,
                      },

                      elevation: item.messageType === 2 ? 0 : 1,
                    }}
                  >
                    {renderMessageContent(item, isMe)}
                  </View>

                  <View
                    style={{
                      marginTop: 4,
                      flexDirection: 'row',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                    }}
                  >
                    {isMe && item.readDate && (
                      <Text
                        style={{
                          fontSize: 10,
                          color: '#999',
                          marginRight: 5,
                        }}
                      >
                        อ่านแล้ว
                      </Text>
                    )}

                    <Text
                      style={{
                        fontSize: 10,
                        color: '#AAA',
                      }}
                    >
                      {new Date(item.createdDate).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
          {isTargetTyping && <TypingIndicator />}
          {/* Input */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 10,
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: '#F2D8E1',
            }}
          >
            <TouchableOpacity
              onPress={handlePickFile}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
                backgroundColor: '#FFF0F5',
              }}
            >
              <Ionicons name="add" size={28} color="#F43879" />
            </TouchableOpacity>

            <TextInput
              value={text}
              onChangeText={handleTextChange}
              placeholder="พิมพ์ข้อความ..."
              placeholderTextColor="#AAA"
              multiline
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 110,
                borderWidth: 1,
                borderColor: '#F2D0DC',
                backgroundColor: '#FFF9FB',
                borderRadius: 22,
                paddingHorizontal: 20,
                paddingVertical: 10,
                marginRight: 8,
                color: '#333',
                fontSize: 15,
              }}
            />
            <TouchableOpacity
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: isRecording ? '#E53935' : '#FFF0F5',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={22}
                color={isRecording ? '#FFFFFF' : '#F43879'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSend}
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#F43879',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
