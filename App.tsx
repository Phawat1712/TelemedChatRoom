import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import UserSelectScreen from './src/screens/UserSelectScreen';
import ChatScreen from './src/screens/ChatScreen';

type ChatParams = {
  conversationID: number;
  currentUserID: number;
  targetUserID: number;
};

function App() {
  const [chatParams, setChatParams] = useState<ChatParams | null>(null);

  return (
    <SafeAreaProvider>
      {chatParams ? (
        <ChatScreen
          conversationID={chatParams.conversationID}
          currentUserID={chatParams.currentUserID}
          targetUserID={chatParams.targetUserID}
          onBack={() => setChatParams(null)}
        />
      ) : (
        <UserSelectScreen
          onStartChat={params => setChatParams(params)}
        />
      )}
    </SafeAreaProvider>
  );
}

export default App;