
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { ENDPOINTS } from '../constants/api';

const { width } = Dimensions.get('window');

export default function Splash() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    // Vérification du token après animation
    const timer = setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) { router.replace('/(auth)/login'); return; }

        const res = await fetch(ENDPOINTS.me, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const user = await res.json();
          await AsyncStorage.setItem('user', JSON.stringify(user));
          router.replace('/(tabs)/feed');
        } else {
          await AsyncStorage.multiRemove(['token', 'user']);
          router.replace('/(auth)/login');
        }
      } catch {
        await AsyncStorage.multiRemove(['token', 'user']);
        router.replace('/(auth)/login');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={s.container}>
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={require('../assets/images/afi-logo.png')}
          style={s.logo}
          resizeMode="contain"
        />
        <View style={s.divider} />
        <Text style={s.title}>Campus Voice</Text>
        <Text style={s.subtitle}>La voix intelligente du campus</Text>
      </Animated.View>
      <Animated.View style={[s.bottom, { opacity: fadeAnim }]}>
        <Text style={s.version}>AFI · L'Université de l'Entreprise · 2026</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 40 },
  logo: { width: width * 0.6, height: 90 },
  divider: { width: 50, height: 2, backgroundColor: '#1d4ed8', borderRadius: 1, marginVertical: 24 },
  title: { fontSize: 32, fontWeight: '900', color: '#f1f5f9', letterSpacing: 1 },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 8, letterSpacing: 0.5 },
  bottom: { position: 'absolute', bottom: 48 },
  version: { fontSize: 12, color: '#334155', textAlign: 'center' },
});