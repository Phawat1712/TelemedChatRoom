import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';

type User = {
  userID: number;
  name: string;
  lastname: string;
};

type Props = {
  onStartChat: (params: {
    conversationID: number;
    currentUserID: number;
    targetUserID: number;
  }) => void;
};

export default function UserSelectScreen({ onStartChat }: Props) {
  const [role, setRole] = useState<'doctor' | 'patient'>('doctor');

  const [doctors, setDoctors] = useState<User[]>([]);
  const [patients, setPatients] = useState<User[]>([]);

  const [currentUserID, setCurrentUserID] = useState<number | null>(null);
  const [targetUserID, setTargetUserID] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const [doctorResponse, patientResponse] = await Promise.all([
        fetch('http://119.59.114.31:9060/Master/GetDoctor'),
        fetch('http://119.59.114.31:9060/Master/GetPatient'),
      ]);

      const doctorResult = await doctorResponse.json();
      const patientResult = await patientResponse.json();

      if (doctorResult.success) {
        setDoctors(doctorResult.data ?? []);
      }

      if (patientResult.success) {
        setPatients(patientResult.data ?? []);
      }
    } catch (error) {
      console.log('Load users error:', error);
    }
  };

  const handleStartChat = async () => {
    if (currentUserID === null || targetUserID === null) {
      Alert.alert('แจ้งเตือน', 'กรุณาเลือกผู้ใช้งานให้ครบ');
      return;
    }

    const doctorUserID =
      role === 'doctor' ? currentUserID : targetUserID;

    const patientUserID =
      role === 'patient' ? currentUserID : targetUserID;

    try {
      const response = await fetch(
        'http://119.59.114.31:9060/Chat/Create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            doctorUserID,
            patientUserID,
          }),
        },
      );

      const result = await response.json();

      console.log('Create conversation:', result);

      if (!result.success) {
        Alert.alert(
          'เกิดข้อผิดพลาด',
          result.message ?? 'ไม่สามารถสร้างห้องได้',
        );
        return;
      }

      onStartChat({
        conversationID: result.data.conversationID,
        currentUserID,
        targetUserID,
      });
    } catch (error) {
      console.log('Create conversation error:', error);

      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Server ได้');
    }
  };

  const currentUsers = role === 'doctor' ? doctors : patients;

  const targetUsers = role === 'doctor' ? patients : doctors;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat Room</Text>

      <Text style={styles.label}>เข้าใช้งานเป็น</Text>

      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[
            styles.roleButton,
            role === 'doctor' && styles.roleButtonSelected,
          ]}
          onPress={() => {
            setRole('doctor');
            setCurrentUserID(null);
            setTargetUserID(null);
          }}
        >
          <Text
            style={[
              styles.roleText,
              role === 'doctor' && styles.roleTextSelected,
            ]}
          >
            หมอ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleButton,
            role === 'patient' && styles.roleButtonSelected,
          ]}
          onPress={() => {
            setRole('patient');
            setCurrentUserID(null);
            setTargetUserID(null);
          }}
        >
          <Text
            style={[
              styles.roleText,
              role === 'patient' && styles.roleTextSelected,
            ]}
          >
            คนไข้
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>เลือกตัวคุณ</Text>

      <FlatList
        data={currentUsers}
        keyExtractor={item => item.userID.toString()}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.userItem,
              currentUserID === item.userID &&
                styles.userItemSelected,
            ]}
            onPress={() => setCurrentUserID(item.userID)}
          >
            <Text>
              {item.name} {item.lastname}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.label}>
        {role === 'doctor'
          ? 'เลือกคนไข้ที่จะคุย'
          : 'เลือกหมอที่จะคุย'}
      </Text>

      <FlatList
        data={targetUsers}
        keyExtractor={item => item.userID.toString()}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.userItem,
              targetUserID === item.userID &&
                styles.userItemSelected,
            ]}
            onPress={() => setTargetUserID(item.userID)}
          >
            <Text>
              {item.name} {item.lastname}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.startButton}
        onPress={handleStartChat}
      >
        <Text style={styles.startButtonText}>
          เริ่มแชท
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },

  roleContainer: {
    flexDirection: 'row',
    gap: 10,
  },

  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  roleButtonSelected: {
    backgroundColor: '#2196F3',
  },

  roleText: {
    color: '#333',
  },

  roleTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  userItem: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },

  userItemSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#EAF4FF',
  },

  startButton: {
    marginTop: 25,
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  startButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});