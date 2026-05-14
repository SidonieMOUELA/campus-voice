
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, RefreshControl,
  Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Animated
} from 'react-native';
import { ENDPOINTS } from '../../constants/api';

// ── Helpers ──────────────────────────────────────────────────────────
function timeAgo(d: string) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function hashColor(s: string) {
  const c = ['#1d4ed8', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#be185d'];
  let h = 0; for (const ch of s) h = ch.charCodeAt(0) + h * 31;
  return c[Math.abs(h) % c.length];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:     { label: 'En attente',     color: '#f59e0b', bg: '#451a03' },
  en_cours:       { label: 'En cours',       color: '#3b82f6', bg: '#1e3a5f' },
  pris_en_charge: { label: 'Pris en charge', color: '#8b5cf6', bg: '#2e1065' },
  resolu:         { label: 'Résolu',         color: '#10b981', bg: '#064e3b' },
};

const CAT_ICONS: Record<string, string> = {
  'WiFi / Réseau': '📡', 'Climatisation': '❄️', 'Électricité': '⚡',
  'Vidéoprojecteur': '📽️', 'Sécurité': '🔒', 'Propreté': '🧹',
  'Administration': '📋', 'Cafétéria': '🍽️', 'Eau': '💧',
  'Transport': '🚌', 'Autre': '📌',
};

// ── Modal Commentaires ────────────────────────────────────────────────
function CommentsModal({ post, onClose, onUpdate, token, me }: any) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charger les vrais commentaires depuis l'API
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(ENDPOINTS.commentaires(String(post.id)), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Format: [{id, contenu, created_at, auteur: {id, prenom, nom, matricule}}]
          const formatted = data.map((c: any) => ({
            id: String(c.id),
            user: c.auteur ? `${c.auteur.prenom || ''} ${c.auteur.nom || ''}`.trim() : 'Étudiant',
            text: c.contenu,
            created_at: c.created_at,
          }));
          setComments(formatted);
        }
      } catch (e) { }
      finally { setLoading(false); }
    };
    load();
  }, [post.id]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(ENDPOINTS.commentaires(String(post.id)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ contenu: text.trim() })
      });
      if (res.ok) {
        const saved = await res.json();
        const newC = {
          id: String(saved.id || Date.now()),
          user: me,
          text: saved.contenu || text.trim(),
          created_at: saved.created_at || new Date().toISOString(),
        };
        const updated = [...comments, newC];
        setComments(updated);
        onUpdate({ ...post, nb_commentaires: updated.length });
        setText('');
      }
    } catch (e) { } finally { setSending(false); }
  };

  return (
    <View style={cm.container}>
      <View style={cm.handle} />
      <View style={cm.header}>
        <Text style={cm.title}>Commentaires ({comments.length})</Text>
        <TouchableOpacity onPress={onClose} style={cm.closeBtn}>
          <Text style={cm.closeX}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={cm.loading}><ActivityIndicator color="#1d4ed8" /></View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={c => c.id}
          style={cm.list}
          ListEmptyComponent={
            <View style={cm.empty}>
              <Text style={cm.emptyIco}>💬</Text>
              <Text style={cm.emptyTxt}>Aucun commentaire — soyez le premier</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={cm.item}>
              <View style={[cm.avatar, { backgroundColor: hashColor(item.user) }]}>
                <Text style={cm.avatarTxt}>{initials(item.user)}</Text>
              </View>
              <View style={cm.itemBody}>
                <View style={cm.itemHead}>
                  <Text style={cm.itemUser}>{item.user}</Text>
                  <Text style={cm.itemTime}>{timeAgo(item.created_at)}</Text>
                </View>
                <Text style={cm.itemText}>{item.text}</Text>
              </View>
            </View>
          )}
        />
      )}

      <View style={cm.inputRow}>
        <TextInput
          style={cm.input}
          placeholder="Ajouter un commentaire..."
          placeholderTextColor="#475569"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={[cm.sendBtn, (!text.trim() || sending) && cm.sendBtnOff]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={cm.sendIco}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cm = StyleSheet.create({
  container: { backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32, maxHeight: '88%' },
  handle: { width: 36, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  title: { fontSize: 16, fontWeight: '800', color: '#f1f5f9' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  closeX: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  loading: { height: 120, justifyContent: 'center', alignItems: 'center' },
  list: { maxHeight: 360 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIco: { fontSize: 40, marginBottom: 10 },
  emptyTxt: { fontSize: 14, color: '#475569' },
  item: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  itemBody: { flex: 1 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemUser: { fontSize: 13, fontWeight: '700', color: '#f1f5f9' },
  itemTime: { fontSize: 11, color: '#475569' },
  itemText: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#f1f5f9', fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: '#334155' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: '#1e293b' },
  sendIco: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

// ── PostCard ──────────────────────────────────────────────────────────
function PostCard({ item, onLike, onComment, onShare }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const s = STATUS[item.status] || STATUS['en_attente'];
  const ico = CAT_ICONS[item.category] || '📌';

  const handleLike = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,   duration: 80, useNativeDriver: true }),
    ]).start();
    onLike(item.id);
  };

  return (
    <View style={pc.card}>
      {/* Header */}
      <View style={pc.header}>
        <View style={[pc.avatar, { backgroundColor: hashColor(item.author) }]}>
          <Text style={pc.avatarTxt}>{initials(item.author)}</Text>
        </View>
        <View style={pc.meta}>
          <Text style={pc.author}>{item.anonyme ? 'Étudiant anonyme' : item.author}</Text>
          <View style={pc.metaRow}>
            <Text style={pc.loc}>◎ {item.location}</Text>
            <Text style={pc.dot}>·</Text>
            <Text style={pc.time}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
        <View style={[pc.statusBadge, { backgroundColor: s.bg }]}>
          <Text style={[pc.statusTxt, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      {/* Catégorie + Urgence */}
      <View style={pc.catRow}>
        <Text style={pc.catIco}>{ico}</Text>
        <Text style={pc.catTxt}>{item.category}</Text>
        {item.niveau_urgence >= 4 && (
          <View style={pc.urgBadge}><Text style={pc.urgTxt}>URGENT</Text></View>
        )}
      </View>

      {/* Contenu */}
      <Text style={pc.title}>{item.title}</Text>
      <Text style={pc.desc} numberOfLines={4}>{item.description}</Text>

      {/* Score IA */}
      {item.score_ia > 0 && (
        <View style={pc.iaRow}>
          <Text style={pc.iaIco}>🤖</Text>
          <View style={pc.iaTrack}>
            <View style={[pc.iaFill, { width: `${Math.min(item.score_ia, 100)}%` as any }]} />
          </View>
          <Text style={pc.iaScore}>Score IA: {Math.round(item.score_ia)}</Text>
        </View>
      )}

      <View style={pc.sep} />

      {/* Actions */}
      <View style={pc.actions}>
        <TouchableOpacity style={pc.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <Animated.Text style={[pc.actionIco, { transform: [{ scale: scaleAnim }] }]}>
            {item.liked ? '❤️' : '🤍'}
          </Animated.Text>
          <Text style={[pc.actionCount, item.liked && { color: '#f43f5e' }]}>{item.likes}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={pc.actionBtn} onPress={() => onComment(item)} activeOpacity={0.7}>
          <Text style={pc.actionIco}>💬</Text>
          <Text style={pc.actionCount}>{item.nb_commentaires || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={pc.actionBtn} onPress={() => onShare(item)} activeOpacity={0.7}>
          <Text style={pc.actionIco}>↗️</Text>
          <Text style={pc.actionCount}>Partager</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: { backgroundColor: '#111827', borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  meta: { flex: 1 },
  author: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  loc: { fontSize: 12, color: '#64748b' },
  dot: { fontSize: 12, color: '#334155' },
  time: { fontSize: 12, color: '#64748b' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, marginBottom: 8 },
  catIco: { fontSize: 14 },
  catTxt: { fontSize: 12, color: '#60a5fa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  urgBadge: { backgroundColor: '#7f1d1d', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 4 },
  urgTxt: { fontSize: 10, color: '#fca5a5', fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 17, fontWeight: '800', color: '#f1f5f9', paddingHorizontal: 14, marginBottom: 6, lineHeight: 24 },
  desc: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 14, lineHeight: 22, marginBottom: 10 },
  iaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 10 },
  iaIco: { fontSize: 13 },
  iaTrack: { flex: 1, height: 4, backgroundColor: '#1e293b', borderRadius: 2 },
  iaFill: { height: 4, backgroundColor: '#3b82f6', borderRadius: 2 },
  iaScore: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  sep: { height: 1, backgroundColor: '#1e293b', marginHorizontal: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14 },
  actionIco: { fontSize: 20 },
  actionCount: { fontSize: 14, color: '#64748b', fontWeight: '600' },
});

// ── Feed principal ────────────────────────────────────────────────────
export default function Feed() {
  const [posts, setPosts]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('');
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [token, setToken]         = useState('');
  const [me, setMe]               = useState('');
  const modalPost = modalPostId ? posts.find(p => p.id === modalPostId) || null : null;

  // Initialiser le token et le nom
  useEffect(() => {
    AsyncStorage.getItem('token').then(t => setToken(t || ''));
    AsyncStorage.getItem('user').then(u => {
      if (u) {
        const d = JSON.parse(u);
        setMe(`${d.prenom || ''} ${d.nom || ''}`.trim() || d.matricule || 'Moi');
      }
    });
  }, []);

  // Charger les signalements depuis le backend
  // Format API: {id, titre, auteur (string), categorie, statut, likes, score_ia,
  //              niveau_urgence, localisation, anonyme, nb_commentaires, created_at}
  const fetchPosts = useCallback(async () => {
    try {
      const t = await AsyncStorage.getItem('token');
      if (!t) return;
      const res = await fetch(ENDPOINTS.signalements, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((item: any) => ({
          id:             String(item.id),
          author:         item.auteur || 'Étudiant',
          title:          item.titre || '',
          category:       item.categorie || 'Autre',
          location:       item.localisation || 'Campus',
          description:    item.description || '',
          likes:          Number(item.likes || 0),
          liked:          false, // backend n'a pas liked_by_me
          status:         item.statut || 'en_attente',
          score_ia:       Number(item.score_ia || 0),
          niveau_urgence: Number(item.niveau_urgence || 0),
          anonyme:        item.anonyme || false,
          nb_commentaires: Number(item.nb_commentaires || 0),
          created_at:     item.created_at || new Date().toISOString(),
        }));
        setPosts(formatted);
      }
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Rafraîchir quand on revient sur le feed (après publication)
  useFocusEffect(useCallback(() => { fetchPosts(); }, [fetchPosts]));

  const onRefresh = () => { setRefreshing(true); fetchPosts(); };

  // Like — POST /signalements/{id}/like
  // Le backend incrémente toujours (+1), donc on toggle côté UI
  const handleLike = useCallback(async (id: string) => {
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
    try {
      const t = await AsyncStorage.getItem('token');
      await fetch(ENDPOINTS.like(id), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}` }
      });
    } catch (e) { }
  }, []);

  const handleShare = useCallback(async (item: any) => {
    await Share.share({
      title: item.title,
      message: `🎓 Campus Voice\n\n${item.title}\n📍 ${item.location}\n\n${item.description}`,
    });
  }, []);

  const updatePost = useCallback((updated: any) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  const FILTERS = [
    { key: '',              label: 'Tous' },
    { key: 'en_attente',   label: 'En attente' },
    { key: 'en_cours',     label: 'En cours' },
    { key: 'resolu',       label: 'Résolus' },
  ];

  const filtered = posts.filter(p => {
    const matchSearch = !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.author.toLowerCase().includes(search.toLowerCase());
    const matchFilter = !filter || p.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <View style={f.container}>
      {/* Header */}
      <View style={f.header}>
        <View>
          <Text style={f.headerTitle}>Campus Voice</Text>
          <Text style={f.headerSub}>{posts.length} signalement{posts.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={f.liveBadge}><Text style={f.liveTxt}>🔴 Live</Text></View>
      </View>

      {/* Recherche */}
      <View style={f.searchBox}>
        <Text style={f.searchIco}>🔍</Text>
        <TextInput
          style={f.searchInput}
          placeholder="Rechercher un signalement..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={f.clearTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <View style={f.filtersRow}>
        {FILTERS.map(fi => (
          <TouchableOpacity
            key={fi.key}
            style={[f.filterChip, filter === fi.key && f.filterChipOn]}
            onPress={() => setFilter(fi.key)}
          >
            <Text style={[f.filterTxt, filter === fi.key && f.filterTxtOn]}>{fi.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste */}
      {loading ? (
        <View style={f.loadingBox}>
          <ActivityIndicator color="#1d4ed8" size="large" />
          <Text style={f.loadingTxt}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard
              item={item}
              onLike={handleLike}
              onComment={(p: any) => setModalPostId(p.id)}
              onShare={handleShare}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d4ed8" colors={['#1d4ed8']} />
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          removeClippedSubviews
          maxToRenderPerBatch={6}
          windowSize={12}
          initialNumToRender={5}
          ListEmptyComponent={
            <View style={f.emptyBox}>
              <Text style={f.emptyIco}>📭</Text>
              <Text style={f.emptyTitle}>Aucun signalement</Text>
              <Text style={f.emptySub}>
                {search ? 'Aucun résultat pour votre recherche' : 'Soyez le premier à signaler un problème'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal commentaires */}
      <Modal
        visible={!!modalPost}
        transparent
        animationType="slide"
        onRequestClose={() => setModalPostId(null)}
      >
        <View style={f.modalOverlay}>
          {modalPost && (
            <CommentsModal
              post={modalPost}
              onClose={() => setModalPostId(null)}
              onUpdate={(updated: any) => { updatePost(updated); setModalPostId(null); }}
              token={token}
              me={me}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const f = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#f1f5f9', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: '#475569', marginTop: 2 },
  liveBadge: { backgroundColor: '#7f1d1d', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  liveTxt: { fontSize: 12, color: '#fca5a5', fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', paddingHorizontal: 12, height: 46 },
  searchIco: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#f1f5f9', fontSize: 15 },
  clearTxt: { color: '#475569', fontSize: 14, fontWeight: '700', padding: 4 },
  filtersRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b' },
  filterChipOn: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  filterTxt: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  filterTxtOn: { color: '#fff' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingTxt: { fontSize: 14, color: '#475569' },
  emptyBox: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIco: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
});
