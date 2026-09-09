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

    const doctorUserID = role === 'doctor' ? currentUserID : targetUserID;

    const patientUserID = role === 'patient' ? currentUserID : targetUserID;

    try {
      const response = await fetch('http://119.59.114.31:9060/Chat/Create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorUserID,
          patientUserID,
        }),
      });

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
      <Text style={styles.title}>Telemed ChatRoom</Text>

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
        renderItem={({ item }) => {
          const selected = currentUserID === item.userID;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.userItem, selected && styles.userItemSelected]}
              onPress={() => setCurrentUserID(item.userID)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {item.name} {item.lastname}
                </Text>

                <Text style={styles.userSubText}>User ID: {item.userID}</Text>
              </View>

              <View
                style={[
                  styles.radioOuter,
                  selected && styles.radioOuterSelected,
                ]}
              >
                {selected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Text style={styles.label}>
        {role === 'doctor' ? 'เลือกคนไข้ที่จะคุย' : 'เลือกหมอที่จะคุย'}
      </Text>

      <FlatList
        data={targetUsers}
        keyExtractor={item => item.userID.toString()}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const selected = targetUserID === item.userID;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.userItem, selected && styles.userItemSelected]}
              onPress={() => setTargetUserID(item.userID)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {item.name} {item.lastname}
                </Text>

                <Text style={styles.userSubText}>User ID: {item.userID}</Text>
              </View>

              <View
                style={[
                  styles.radioOuter,
                  selected && styles.radioOuterSelected,
                ]}
              >
                {selected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.startButton} onPress={handleStartChat}>
        <Text style={styles.startButtonText}>เริ่มแชท</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 54,
    backgroundColor: '#FFF7FA',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F43879',
    marginBottom: 6,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 28,
  },

  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 18,
    marginBottom: 10,
  },

  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },

  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F6C7D7',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  roleButtonSelected: {
    borderColor: '#F43879',
    backgroundColor: '#FFF0F5',
  },

  roleText: {
    color: '#777',
    fontSize: 15,
    fontWeight: '600',
  },

  roleTextSelected: {
    color: '#F43879',
    fontWeight: '800',
  },

  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1D5DF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',

    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 2,
  },

  userItemSelected: {
    borderColor: '#F43879',
    backgroundColor: '#FFF0F5',
  },

  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },

  userSubText: {
    marginTop: 3,
    fontSize: 12,
    color: '#999',
  },

  startButton: {
    marginTop: 24,
    backgroundColor: '#F43879',
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',

    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 4,
  },

  startButtonDisabled: {
    backgroundColor: '#F6B7CD',
  },

  startButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFE2EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#F43879',
    fontSize: 18,
    fontWeight: '800',
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  radioOuterSelected: {
    borderColor: '#F43879',
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F43879',
  },
});
