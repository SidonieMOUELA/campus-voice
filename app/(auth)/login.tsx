import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView, Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { ENDPOINTS } from '../../constants/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(ENDPOINTS.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        router.replace('/(tabs)/feed');
      } else {
        Alert.alert('Erreur', data.message || 'Identifiants incorrects');
      }
    } catch (e) {
      // Mode démo si l'API n'est pas encore prête
      await AsyncStorage.setItem('token', 'demo-token');
      await AsyncStorage.setItem('user', JSON.stringify({
        name: 'Hassane Demo', email, xp: 120
      }));
      router.replace('/(tabs)/feed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🎓</Text>
        <Text style={styles.title}>Campus Voice</Text>
        <Text style={styles.subtitle}>Connecte-toi avec ton email institutionnel</Text>

        <TextInput
          style={styles.input}
          placeholder="email@universite.sn"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Se connecter</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#f8fafc', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 32, marginTop: 8 },
  input: {
    backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 12,
    padding: 16, marginBottom: 16, fontSize: 16, borderWidth: 1, borderColor: '#334155'
  },
  button: {
    backgroundColor: '#3b82f6', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});