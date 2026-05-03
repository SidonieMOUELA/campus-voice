
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ENDPOINTS } from '../../constants/api';

// Données de démo si l'API n'est pas prête
const DEMO_DATA = [
  { id: '1', title: 'WiFi en panne bloc A', category: 'Réseau Internet',
    description: 'Impossible de se connecter depuis ce matin dans toutes les salles du bloc A.',
    likes: 24, comments: 8, status: 'En cours', priority: 'urgent', location: 'Bloc A' },
  { id: '2', title: 'Clim cassée salle 204', category: 'Climatisation',
    description: 'La climatisation de la salle 204 ne fonctionne plus depuis 3 jours.',
    likes: 15, comments: 3, status: 'En attente', priority: 'normal', location: 'Bâtiment B' },
  { id: '3', title: 'Vidéoprojecteur HS', category: 'Vidéoprojecteur',
    description: 'Le projecteur de l\'amphi 1 affiche une image floue.',
    likes: 9, comments: 2, status: 'Résolu', priority: 'normal', location: 'Amphi 1' },
];

const STATUS_COLORS: Record<string, string> = {
  'urgent': '#ef4444',
  'normal': '#3b82f6',
};

const STATUS_BG: Record<string, string> = {
  'En cours': '#1d4ed8',
  'En attente': '#92400e',
  'Résolu': '#065f46',
};

export default function Feed() {
  const [signalements, setSignalements] = useState(DEMO_DATA);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchSignalements = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token === 'demo-token') return; // garder les données démo
      const res = await fetch(ENDPOINTS.signalements, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSignalements(data);
      }
    } catch (e) {
      // API pas encore prête, on garde les données démo
    }
  };

  const handleLike = async (id: string) => {
    setSignalements(prev =>
      prev.map(s => s.id === id ? { ...s, likes: s.likes + 1 } : s)
    );
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(ENDPOINTS.like(id), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSignalements();
    setRefreshing(false);
  };

  useEffect(() => { fetchSignalements(); }, []);

  const filtered = signalements.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.priorityDot, { backgroundColor: STATUS_COLORS[item.priority] || '#3b82f6' }]} />
        <Text style={styles.category}>{item.category}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[item.status] || '#1e293b' }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.location}>📍 {item.location}</Text>
      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(item.id)}>
          <Text style={styles.likeText}>👍 {item.likes}</Text>
        </TouchableOpacity>
        <Text style={styles.commentText}>💬 {item.comments}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Campus Voice</Text>
        <Text style={styles.headerSub}>Signalements du campus</Text>
      </View>
      <TextInput
        style={styles.search}
        placeholder="🔍 Rechercher..."
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 20, paddingTop: 56, backgroundColor: '#1e293b' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
  headerSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  search: {
    margin: 16, backgroundColor: '#1e293b', borderRadius: 12,
    padding: 12, color: '#f8fafc', fontSize: 15, borderWidth: 1, borderColor: '#334155'
  },
  card: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#334155'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  category: { fontSize: 12, color: '#94a3b8', flex: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, color: '#f8fafc', fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#94a3b8', marginBottom: 8, lineHeight: 20 },
  location: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  likeBtn: { backgroundColor: '#1d4ed820', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  likeText: { color: '#60a5fa', fontWeight: '600' },
  commentText: { color: '#64748b', fontSize: 14 },
});