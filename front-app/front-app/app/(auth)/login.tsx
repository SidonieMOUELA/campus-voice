import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions,
  Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { ENDPOINTS, API_URL } from '../../constants/api';

const { width } = Dimensions.get('window');

export default function Login() {
  const router = useRouter();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!matricule.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append('username', matricule.trim());
      form.append('password', password);

      const res = await fetch(ENDPOINTS.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const data = await res.json();

      if (res.ok && data.access_token) {
        await AsyncStorage.setItem('token', data.access_token);
        const meRes = await fetch(ENDPOINTS.me, {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        if (meRes.ok) {
          const user = await meRes.json();
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
        router.replace('/(tabs)/feed');
      } else {
        Alert.alert('Connexion refusée', data.detail || 'Matricule ou mot de passe incorrect');
      }
    } catch (e) {
      Alert.alert('Erreur réseau', `Impossible de joindre le serveur.\n${API_URL}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo AFI */}
        <View style={s.logoContainer}>
          <Image
            source={require('../../assets/images/afi-logo.png')}
            style={s.logo}
            resizeMode="contain"
          />
          <View style={s.divider} />
          <Text style={s.appName}>Campus Voice</Text>
          <Text style={s.appTagline}>La voix intelligente du campus</Text>
        </View>

        {/* Formulaire */}
        <View style={s.form}>
          <Text style={s.welcomeTitle}>Connexion</Text>
          <Text style={s.welcomeSub}>Connectez-vous avec votre matricule AFI</Text>

          <View style={s.inputGroup}>
            <Text style={s.label}>Matricule AFI</Text>
            <View style={s.inputWrapper}>
              <Text style={s.inputIcon}>🎓</Text>
              <TextInput
                style={s.input}
                placeholder="Ex: AFI001"
                placeholderTextColor="#475569"
                value={matricule}
                onChangeText={setMatricule}
                autoCapitalize="characters"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>Mot de passe</Text>
            <View style={s.inputWrapper}>
              <Text style={s.inputIcon}>🔒</Text>
              <TextInput
                style={s.input}
                placeholder="Votre mot de passe"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                <Text style={s.eyeIcon}>{showPass ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[s.loginBtn, loading && s.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.loginBtnText}>Se connecter</Text>
            }
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>AFI — L'Université de l'Entreprise</Text>
            <Text style={s.footerSub}>Plateforme sécurisée · Données cryptées</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40, paddingTop: 40 },
  logo: { width: width * 0.55, height: 80 },
  divider: { width: 60, height: 2, backgroundColor: '#1d4ed8', borderRadius: 1, marginVertical: 20 },
  appName: { fontSize: 28, fontWeight: '900', color: '#f1f5f9', letterSpacing: 1 },
  appTagline: { fontSize: 14, color: '#64748b', marginTop: 6, letterSpacing: 0.5 },
  form: { backgroundColor: '#111827', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: '#1e293b' },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: '#64748b', marginBottom: 28 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 14, height: 52
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, color: '#f1f5f9', fontSize: 16, fontWeight: '500' },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },
  loginBtn: {
    backgroundColor: '#1d4ed8', borderRadius: 14, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
    shadowColor: '#1d4ed8', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  footer: { alignItems: 'center', marginTop: 28 },
  footerText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  footerSub: { fontSize: 11, color: '#334155', marginTop: 4 },
});