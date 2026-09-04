import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  BackHandler,
} from 'react-native';
import * as signalR from '@microsoft/signalr';

import { chatConnection } from '../services/chatSignalR';

type Message = {
  messageID: number;
  conversationID: number;
  senderUserID: number;
  messageType: number;
  message: string;
  createdDate: string;
};

type Props = {
  conversationID: number;
  currentUserID: number;
  targetUserID: number;
  onBack: () => void;
};

export default function ChatScreen({
  conversationID,
  currentUserID,
  targetUserID,
  onBack,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    loadMessages();
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

    chatConnection.on('ReceiveMessage', (message: Message) => {
      console.log('ReceiveMessage:', message);

      setMessages(prev => [...prev, message]);
    });

    connectSignalR();

    return () => {
      chatConnection.off('ReceiveMessage');

      if (chatConnection.state === signalR.HubConnectionState.Connected) {
        chatConnection
          .invoke('LeaveConversation', conversationID)
          .catch(error => {
            console.log('Leave conversation error:', error);
          });
      }
    };
  }, [conversationID]);

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

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#ddd',
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          style={{
            paddingVertical: 6,
            paddingRight: 16,
          }}
        >
          <Text style={{ fontSize: 18 }}>← กลับ</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 18, fontWeight: '600' }}>ห้องแชท</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.messageID.toString()}
        contentContainerStyle={{
          padding: 16,
        }}
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf:
                item.senderUserID === currentUserID ? 'flex-end' : 'flex-start',
              backgroundColor:
                item.senderUserID === currentUserID ? '#DCF8C6' : '#EEEEEE',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              marginBottom: 8,
              maxWidth: '75%',
            }}
          >
            <Text>{item.message}</Text>
          </View>
        )}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 10,
          borderTopWidth: 1,
          borderTopColor: '#ddd',
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="พิมพ์ข้อความ..."
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginRight: 8,
          }}
        />

        <TouchableOpacity
          onPress={handleSend}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: '#2196F3',
            borderRadius: 20,
          }}
        >
          <Text style={{ color: '#fff' }}>ส่ง</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
