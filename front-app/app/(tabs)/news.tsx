
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Modal,
  RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View
} from 'react-native';
import { ENDPOINTS, API_URL } from '../../constants/api';

function timeAgo(d: string) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const j = Math.floor(h / 24);
  if (j < 30) return `${j}j`;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const TYPE_CFG: Record<string,{color:string;bg:string;label:string;border:string}> = {
  urgence: { color:'#fca5a5', bg:'#7f1d1d', label:'URGENCE', border:'#ef4444' },
  alerte:  { color:'#fde68a', bg:'#78350f', label:'ALERTE',  border:'#f59e0b' },
  info:    { color:'#bfdbfe', bg:'#1e3a5f', label:'INFO',    border:'#3b82f6' },
  event:   { color:'#bbf7d0', bg:'#064e3b', label:'ÉVÉNEMENT', border:'#10b981' },
};
const EMOJIS = ['👍','❤️','😂','😮','😢','👏'];

export default function News() {
  const [infos, setInfos]       = useState<any[]>([]);
  const [urgences, setUrgences] = useState<any[]>([]);
  const [kpis, setKpis]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [token, setToken]       = useState('');

  const fetchData = useCallback(async (silent = false) => {
    const t = await AsyncStorage.getItem('token');
    setToken(t || '');
    if (!t) { setLoading(false); return; }
    if (!silent) setLoading(true);
    const hdrs = { 'Authorization': `Bearer ${t}` };

    try {
      const [ir, ur, kr] = await Promise.allSettled([
        fetch(ENDPOINTS.infos,    { headers: hdrs }),
        fetch(ENDPOINTS.urgences, { headers: hdrs }),
        fetch(ENDPOINTS.kpis,     { headers: hdrs }),
      ]);

      if (ir.status==='fulfilled' && ir.value.ok) {
        const d = await ir.value.json();
        setInfos(Array.isArray(d) ? d : []);
      }
      if (ur.status==='fulfilled' && ur.value.ok) {
        const d = await ur.value.json();
        setUrgences(Array.isArray(d) ? d.slice(0,5) : []);
      }
      if (kr.status==='fulfilled' && kr.value.ok) {
        setKpis(await kr.value.json());
      }
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(true); };

  const sendReaction = async (infoId: number, emoji: string) => {
    if (!token) return;
    try {
      await fetch(ENDPOINTS.infoReaction(String(infoId)), {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ emoji })
      });
      fetchData(true);
    } catch (e) { }
  };

  if (loading) return (
    <View style={n.center}>
      <ActivityIndicator color="#1d4ed8" size="large" />
      <Text style={n.loadingTxt}>Chargement des actualités...</Text>
    </View>
  );

  return (
    <View style={n.container}>
      {/* Header */}
      <View style={n.header}>
        <Text style={n.headerTitle}>Actualités</Text>
        <Text style={n.headerSub}>Campus AFI · Informations officielles</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d4ed8" />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPIs */}
        {kpis && (
          <View style={n.kpisSection}>
            <Text style={n.secLbl}>TABLEAU DE BORD EN DIRECT</Text>
            <View style={n.kpisRow}>
              {[
                { val: kpis.total_signalements ?? 0, lbl:'Signalements', ico:'📊', col:'#3b82f6' },
                { val: kpis.resolus ?? 0,             lbl:'Résolus',      ico:'✅', col:'#10b981' },
                { val: kpis.urgents ?? urgences.length,lbl:'Urgents',     ico:'🚨', col:'#ef4444' },
                { val: kpis.taux_resolution ? `${Math.round(kpis.taux_resolution)}%`:'0%', lbl:'Résolution', ico:'📈', col:'#8b5cf6' },
              ].map(k => (
                <View key={k.lbl} style={n.kpiBox}>
                  <Text style={n.kpiIco}>{k.ico}</Text>
                  <Text style={[n.kpiVal, { color: k.col }]}>{k.val}</Text>
                  <Text style={n.kpiLbl}>{k.lbl}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Urgences */}
        {urgences.length > 0 && (
          <View style={n.sec}>
            <View style={n.secHeaderRow}>
              <Text style={n.secLbl}>🚨 SIGNALEMENTS URGENTS</Text>
              <View style={n.liveDot}><Text style={n.liveTxt}>● LIVE</Text></View>
            </View>
            {urgences.map(u => (
              <View key={u.id} style={n.urgCard}>
                <View style={n.urgDot} />
                <View style={{ flex: 1 }}>
                  <Text style={n.urgTitre}>{u.titre}</Text>
                  <Text style={n.urgLoc}>◎ {u.localisation||'Campus'} · Urgence {u.niveau_urgence}/5</Text>
                </View>
                <View style={n.urgBadge}>
                  <Text style={n.urgBadgeTxt}>NIV {u.niveau_urgence}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Infos officielles */}
        <View style={n.sec}>
          <Text style={n.secLbl}>📢 INFORMATIONS OFFICIELLES</Text>
          {infos.length === 0 ? (
            <View style={n.emptyCard}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
              <Text style={n.emptyTitre}>Aucune information disponible</Text>
              <Text style={n.emptySub}>L'administration publiera bientôt des actualités</Text>
            </View>
          ) : (
            infos.map(info => {
              const cfg = TYPE_CFG[info.type] || TYPE_CFG.info;
              return (
                <TouchableOpacity
                  key={info.id}
                  style={[n.infoCard, { borderLeftColor: cfg.border }]}
                  onPress={() => setSelected(info)}
                  activeOpacity={0.85}
                >
                  {/* Image de preview si disponible */}
                  {info.has_image && info.image_url && (
                    <Image
                      source={{ uri: `${API_URL}${info.image_url}`, headers: { 'Authorization': `Bearer ${token}` } }}
                      style={n.infoPreviewImg}
                      resizeMode="cover"
                    />
                  )}
                  <View style={n.infoContent}>
                    <View style={n.infoTop}>
                      <View style={[n.typeBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[n.typeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                      <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
                        {info.has_video && <Text style={{ fontSize: 14 }}>🎬</Text>}
                        {info.has_image && <Text style={{ fontSize: 14 }}>🖼️</Text>}
                        <Text style={n.infoTime}>{timeAgo(info.created_at)}</Text>
                      </View>
                    </View>
                    <Text style={n.infoTitre}>{info.titre}</Text>
                    {info.description && (
                      <Text style={n.infoDesc} numberOfLines={3}>{info.description}</Text>
                    )}
                    <View style={n.infoFooter}>
                      {info.auteur && <Text style={n.infoAuteur}>Par {info.auteur}</Text>}
                      <Text style={n.readMore}>Lire la suite →</Text>
                    </View>
                    {info.date_evenement && (
                      <View style={n.eventRow}>
                        <Text style={{ fontSize: 13 }}>📅</Text>
                        <Text style={n.eventTxt}>{info.date_evenement}</Text>
                      </View>
                    )}
                    {/* Réactions */}
                    {info.reactions && Object.keys(info.reactions).length > 0 && (
                      <View style={n.reactionsRow}>
                        {Object.entries(info.reactions).map(([emoji, count]: any) => (
                          <View key={emoji} style={[n.reactionPill, info.mon_emoji===emoji && n.reactionPillOn]}>
                            <Text style={{ fontSize: 14 }}>{emoji}</Text>
                            <Text style={n.reactionCount}>{count}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal détail info */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={n.modalOverlay}>
          <View style={n.modalContent}>
            <View style={n.modalHandle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header modal */}
                <View style={n.modalHeader}>
                  <View style={[n.typeBadge, { backgroundColor: (TYPE_CFG[selected.type]?.bg || TYPE_CFG.info.bg) }]}>
                    <Text style={[n.typeTxt, { color: TYPE_CFG[selected.type]?.color || TYPE_CFG.info.color }]}>
                      {TYPE_CFG[selected.type]?.label || 'INFO'}
                    </Text>
                  </View>
                  <Text style={n.modalTime}>{timeAgo(selected.created_at)}</Text>
                </View>

                {/* Image plein format */}
                {selected.has_image && selected.image_url && (
                  <Image
                    source={{
                      uri: `${API_URL}${selected.image_url}`,
                      headers: { 'Authorization': `Bearer ${token}` }
                    }}
                    style={n.modalImg}
                    resizeMode="contain"
                  />
                )}

                {/* Titre et auteur */}
                <Text style={n.modalTitre}>{selected.titre}</Text>
                {selected.auteur && (
                  <Text style={n.modalAuteur}>Publié par {selected.auteur}</Text>
                )}
                {selected.date_evenement && (
                  <View style={n.modalEventRow}>
                    <Text style={{ fontSize: 16 }}>📅</Text>
                    <Text style={n.modalEventTxt}>Événement : {selected.date_evenement}</Text>
                  </View>
                )}

                {/* Description */}
                <Text style={n.modalDesc}>
                  {selected.description || 'Aucune description disponible.'}
                </Text>

                {/* Badge vidéo */}
                {selected.has_video && selected.video_url && (
                  <TouchableOpacity
                    style={n.videoBadge}
                    onPress={() => Linking.openURL(`${API_URL}${selected.video_url}`)}
                  >
                    <Text style={{ fontSize: 24 }}>🎬</Text>
                    <View>
                      <Text style={n.videoTxt}>Vidéo disponible</Text>
                      <Text style={n.videoSub}>Appuyez pour ouvrir</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Lien externe */}
                {selected.lien && (
                  <TouchableOpacity
                    style={n.linkBtn}
                    onPress={() => Linking.openURL(selected.lien)}
                  >
                    <Text style={n.linkBtnTxt}>🔗 Voir le lien externe →</Text>
                  </TouchableOpacity>
                )}

                {/* Réactions emoji */}
                <View style={n.reactionsSec}>
                  <Text style={n.reactionsTitle}>Réagir</Text>
                  <View style={n.emojisRow}>
                    {EMOJIS.map(emoji => (
                      <TouchableOpacity
                        key={emoji}
                        style={[n.emojiBtn, selected.mon_emoji === emoji && n.emojiBtnOn]}
                        onPress={() => sendReaction(selected.id, emoji)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                        {selected.reactions?.[emoji] && (
                          <Text style={n.emojiBtnCount}>{selected.reactions[emoji]}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={n.closeBtn} onPress={() => setSelected(null)}>
              <Text style={n.closeBtnTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const n = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0f1e' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1e', gap: 12 },
  loadingTxt: { fontSize: 14, color: '#475569' },
  header:     { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle:{ fontSize: 26, fontWeight: '900', color: '#f1f5f9', letterSpacing: -0.5 },
  headerSub:  { fontSize: 13, color: '#475569', marginTop: 4 },

  // KPIs
  kpisSection: { margin: 16, backgroundColor: '#111827', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  kpisRow:     { flexDirection: 'row', gap: 8 },
  kpiBox:      { flex: 1, backgroundColor: '#0a0f1e', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  kpiIco:      { fontSize: 20, marginBottom: 6 },
  kpiVal:      { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  kpiLbl:      { fontSize: 10, color: '#475569', marginTop: 4, textAlign: 'center', fontWeight: '600' },

  // Section
  sec:          { marginHorizontal: 16, marginBottom: 16 },
  secLbl:       { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  secHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  liveDot:      { backgroundColor: '#7f1d1d', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  liveTxt:      { fontSize: 11, color: '#fca5a5', fontWeight: '800' },

  // Urgences
  urgCard:      { flexDirection:'row', alignItems:'center', backgroundColor:'#111827', borderRadius:14, padding:14, marginBottom:8, gap:12, borderWidth:1, borderColor:'#7f1d1d33' },
  urgDot:       { width:10, height:10, borderRadius:5, backgroundColor:'#ef4444', flexShrink:0 },
  urgTitre:     { fontSize:14, fontWeight:'700', color:'#f1f5f9' },
  urgLoc:       { fontSize:12, color:'#64748b', marginTop:2 },
  urgBadge:     { backgroundColor:'#7f1d1d', borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  urgBadgeTxt:  { fontSize:11, color:'#fca5a5', fontWeight:'800' },

  // Info Card
  infoCard:       { backgroundColor:'#111827', borderRadius:16, marginBottom:12, borderLeftWidth:3, borderWidth:1, borderColor:'#1e293b', overflow:'hidden' },
  infoPreviewImg: { width:'100%', height:180, backgroundColor:'#1e293b' },
  infoContent:    { padding:16 },
  infoTop:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  typeBadge:      { borderRadius:8, paddingHorizontal:10, paddingVertical:4 },
  typeTxt:        { fontSize:11, fontWeight:'800', letterSpacing:0.5 },
  infoTime:       { fontSize:12, color:'#475569' },
  infoTitre:      { fontSize:16, fontWeight:'800', color:'#f1f5f9', marginBottom:8, lineHeight:22 },
  infoDesc:       { fontSize:14, color:'#94a3b8', lineHeight:20, marginBottom:10 },
  infoFooter:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  infoAuteur:     { fontSize:12, color:'#475569' },
  readMore:       { fontSize:13, color:'#3b82f6', fontWeight:'700' },
  eventRow:       { flexDirection:'row', alignItems:'center', gap:6, marginTop:10, backgroundColor:'#0a0f1e', borderRadius:8, padding:8 },
  eventTxt:       { fontSize:13, color:'#94a3b8', fontWeight:'600' },

  // Réactions
  reactionsRow:   { flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:10 },
  reactionPill:   { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#1e293b', borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  reactionPillOn: { backgroundColor:'#1d4ed840', borderWidth:1, borderColor:'#3b82f6' },
  reactionCount:  { fontSize:12, color:'#94a3b8', fontWeight:'700' },

  // Empty
  emptyCard:  { backgroundColor:'#111827', borderRadius:20, padding:40, alignItems:'center', borderWidth:1, borderColor:'#1e293b' },
  emptyTitre: { fontSize:17, fontWeight:'800', color:'#f1f5f9', marginBottom:8 },
  emptySub:   { fontSize:13, color:'#64748b', textAlign:'center', lineHeight:20 },

  // Modal
  modalOverlay:  { flex:1, backgroundColor:'rgba(0,0,0,0.8)', justifyContent:'flex-end' },
  modalContent:  { backgroundColor:'#111827', borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, maxHeight:'90%' },
  modalHandle:   { width:36, height:4, backgroundColor:'#334155', borderRadius:2, alignSelf:'center', marginBottom:20 },
  modalHeader:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  modalTime:     { fontSize:12, color:'#475569' },
  modalImg:      { width:'100%', height:220, borderRadius:16, marginBottom:16, backgroundColor:'#1e293b' },
  modalTitre:    { fontSize:22, fontWeight:'900', color:'#f1f5f9', lineHeight:30, marginBottom:8 },
  modalAuteur:   { fontSize:13, color:'#64748b', marginBottom:12 },
  modalEventRow: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#1e293b', borderRadius:10, padding:12, marginBottom:14 },
  modalEventTxt: { fontSize:14, color:'#94a3b8', fontWeight:'600' },
  modalDesc:     { fontSize:15, color:'#94a3b8', lineHeight:26, marginBottom:20 },
  videoBadge:    { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#1e293b', borderRadius:16, padding:16, marginBottom:16 },
  videoTxt:      { fontSize:15, color:'#f1f5f9', fontWeight:'700' },
  videoSub:      { fontSize:12, color:'#64748b', marginTop:2 },
  linkBtn:       { backgroundColor:'#1e3a5f', borderRadius:12, padding:14, alignItems:'center', marginBottom:16 },
  linkBtnTxt:    { color:'#60a5fa', fontWeight:'700', fontSize:15 },
  reactionsSec:  { marginBottom:20 },
  reactionsTitle:{ fontSize:13, fontWeight:'800', color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 },
  emojisRow:     { flexDirection:'row', justifyContent:'space-around' },
  emojiBtn:      { alignItems:'center', padding:10, borderRadius:16, backgroundColor:'#1e293b', minWidth:50 },
  emojiBtnOn:    { backgroundColor:'#1d4ed840', borderWidth:1, borderColor:'#3b82f6' },
  emojiBtnCount: { fontSize:11, color:'#94a3b8', marginTop:4, fontWeight:'700' },
  closeBtn:      { backgroundColor:'#1e293b', borderRadius:14, padding:16, alignItems:'center', marginTop:8 },
  closeBtnTxt:   { color:'#94a3b8', fontWeight:'700', fontSize:15 },
});