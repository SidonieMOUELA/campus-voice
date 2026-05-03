import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        router.replace('/(tabs)/feed');
      } else {
        router.replace('/(auth)/login');
      }
    };
    checkToken();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0f172a' }}>
      <ActivityIndicator color="#3b82f6" size="large" />
    </View>
  );
}