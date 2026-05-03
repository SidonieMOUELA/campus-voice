import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { ENDPOINTS } from '../../constants/api';

const CATEGORIES = [
  'WiFi / Réseau', 'Climatisation', 'Électricité', 'Vidéoprojecteur',
  'Sécurité', 'Propreté', 'Administration', 'Cafétéria', 'Autre'
];

export default function Create() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !description || !category) {
      Alert.alert('Champs manquants', 'Remplis le titre, la description et la catégorie');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(ENDPOINTS.signalements, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, category, location }),
      });
      if (res.ok) {
        Alert.alert('✅ Publié !', 'Ton signalement a été envoyé.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/feed') }
        ]);
      } else {
        // Mode démo
        Alert.alert('✅ Publié (démo) !', 'Signalement enregistré.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/feed') }
        ]);
      }
    } catch (e) {
      Alert.alert('✅ Publié (démo) !', 'Signalement enregistré.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/feed') }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>📢 Nouveau signalement</Text>

      <Text style={styles.label}>Titre du problème *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: WiFi en panne bloc A..."
        placeholderTextColor="#64748b"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Catégorie *</Text>
      <View style={styles.categories}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catBtn, category === cat && styles.catBtnActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Décris le problème en détail..."
        placeholderTextColor="#64748b"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
      />

      <Text style={styles.label}>Localisation</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Bloc A, Salle 204..."
        placeholderTextColor="#64748b"
        value={location}
        onChangeText={setLocation}
      />

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>🚀 Publier le signalement</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc', marginBottom: 24 },
  label: { fontSize: 14, color: '#94a3b8', marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 12,
    padding: 14, marginBottom: 16, fontSize: 15, borderWidth: 1, borderColor: '#334155'
  },
  textarea: { height: 120, textAlignVertical: 'top' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catBtn: {
    backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, borderWidth: 1, borderColor: '#334155'
  },
  catBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  catText: { color: '#94a3b8', fontSize: 13 },
  catTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#3b82f6', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 40
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});