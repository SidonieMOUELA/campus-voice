
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList,
  RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View
} from 'react-native';
import { ENDPOINTS } from '../../constants/api';

// ─── Helpers ──────────────────────────────────────────────────────────
function hashColor(s: string) {
  const colors = ['#1d4ed8','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d'];
  let h = 0;
  for (const c of s) h = c.charCodeAt(0) + h * 31;
  return colors[Math.abs(h) % colors.length];
}

function getInitials(prenom: string, nom: string) {
  return `${(prenom||'')[0]||''}${(nom||'')[0]||''}`.toUpperCase() || '?';
}

function getMention(avg: number) {
  if (avg >= 16) return { label: 'Très Bien',  color: '#10b981' };
  if (avg >= 14) return { label: 'Bien',        color: '#3b82f6' };
  if (avg >= 12) return { label: 'Assez Bien',  color: '#8b5cf6' };
  if (avg >= 10) return { label: 'Passable',    color: '#f59e0b' };
  return           { label: 'Insuffisant', color: '#ef4444' };
}

function noteColor(n: number) {
  if (n >= 14) return '#10b981';
  if (n >= 10) return '#f59e0b';
  return '#ef4444';
}

const JOURS_FULL  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const JOURS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam'];
const MOIS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const STATUT_SEANCE: Record<string,{label:string;color:string;bg:string}> = {
  programme: { label:'Programmé',  color:'#10b981', bg:'#064e3b' },
  annule:    { label:'Annulé',     color:'#ef4444', bg:'#7f1d1d' },
  reporte:   { label:'Reporté',    color:'#f59e0b', bg:'#451a03' },
  en_ligne:  { label:'En ligne',   color:'#3b82f6', bg:'#1e3a5f' },
};

const BADGE_MAP: Record<string,{icon:string;label:string;color:string}> = {
  etudiant_actif:     { icon:'⭐', label:'Étudiant actif',       color:'#f59e0b' },
  super_contributeur: { icon:'🏆', label:'Super contributeur',   color:'#7c3aed' },
  protecteur_campus:  { icon:'🛡️', label:'Protecteur du campus', color:'#1d4ed8' },
  ambassadeur:        { icon:'🎖️', label:'Ambassadeur',          color:'#059669' },
  top_signalement:    { icon:'🔥', label:'Top signalement',      color:'#dc2626' },
};

// ══════════════════════════════════════════════════════════════════════
// TAB PROFIL
// ══════════════════════════════════════════════════════════════════════
function TabProfil({ token }: { token: string }) {
  const router = useRouter();
  const [user, setUser]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('user');
      if (cached) { setUser(JSON.parse(cached)); setLoading(false); }
      if (!token) return;
      const res = await fetch(ENDPOINTS.me, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        await AsyncStorage.setItem('user', JSON.stringify(data));
      }
    } catch (_) {}
    finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove(['token','user']);
        router.replace('/(auth)/login');
      }}
    ]);
  };

  if (loading && !user) return (
    <View style={st.center}><ActivityIndicator color="#1d4ed8" size="large" /></View>
  );
  if (!user) return (
    <View style={st.center}>
      <Text style={{ color: '#64748b', fontSize: 16 }}>Impossible de charger le profil</Text>
    </View>
  );

  const prenom  = user.prenom || '';
  const nom     = user.nom || '';
  const xp      = Number(user.xp || 0);
  const niveau  = Math.floor(xp / 50) + 1;
  const xpPct   = (xp % 50) / 50;
  const xpNext  = 50 - (xp % 50);
  const avatarColor = hashColor(prenom + nom);
  const initials    = getInitials(prenom, nom);
  const badges  = Array.isArray(user.badges) ? user.badges : [];
  const nbSigs  = user.nb_signalements ?? 0;
  const moyGen  = user.moyenne_generale ?? null;
  const mention = moyGen !== null ? getMention(Number(moyGen)) : null;

  return (
    <Animated.ScrollView style={{ opacity: fadeAnim }} showsVerticalScrollIndicator={false}>

      {/* Hero */}
      <View style={st.hero}>
        <View style={st.heroBg} />
        <View style={[st.heroAvatar, { backgroundColor: avatarColor }]}>
          <Text style={st.heroAvatarTxt}>{initials}</Text>
          {user.role === 'admin' && <View style={st.adminDot} />}
        </View>
        <Text style={st.heroName}>{prenom} {nom}</Text>
        {!!user.classe      && <Text style={st.heroClasse}>{user.classe}</Text>}
        {!!user.filiere_label && <Text style={st.heroFiliere}>{user.filiere_label}</Text>}
        {!!user.niveau_label  && <Text style={st.heroNiveau}>{user.niveau_label}</Text>}
        {user.role === 'admin' && (
          <View style={st.adminBadge}><Text style={st.adminBadgeTxt}>ADMINISTRATEUR</Text></View>
        )}
      </View>

      {/* Stats */}
      <View style={st.statsRow}>
        <View style={st.statBox}>
          <Text style={st.statVal}>{nbSigs}</Text>
          <Text style={st.statLbl}>Signalements</Text>
          <Text style={st.statIco}>📢</Text>
        </View>
        <View style={st.statBox}>
          <Text style={[st.statVal, { color: '#f59e0b' }]}>{xp}</Text>
          <Text style={st.statLbl}>Score XP</Text>
          <Text style={st.statIco}>⚡</Text>
        </View>
        {moyGen !== null && (
          <View style={st.statBox}>
            <Text style={[st.statVal, { color: mention?.color || '#f1f5f9' }]}>
              {Number(moyGen).toFixed(1)}
            </Text>
            <Text style={st.statLbl}>Moyenne</Text>
            <Text style={st.statIco}>📊</Text>
          </View>
        )}
      </View>

      {/* XP Progress */}
      <View style={st.sec}>
        <View style={st.xpCard}>
          <View style={st.xpTop}>
            <View>
              <Text style={st.xpNiv}>Niveau {niveau}</Text>
              <Text style={st.xpSub}>{xpNext} XP pour le niveau {niveau + 1}</Text>
            </View>
            <View style={st.xpBadge}><Text style={st.xpBadgeTxt}>{xp} XP</Text></View>
          </View>
          <View style={st.xpTrack}>
            <View style={[st.xpFill, { width: `${Math.min(xpPct * 100, 100)}%` as any }]} />
          </View>
          <View style={st.xpLevels}>
            <Text style={st.xpLevelTxt}>Niv. {niveau}</Text>
            <Text style={st.xpLevelTxt}>Niv. {niveau + 1}</Text>
          </View>
        </View>
      </View>

      {/* Infos personnelles */}
      <View style={st.sec}>
        <Text style={st.secTitle}>Informations</Text>
        <View style={st.infoCard}>
          {[
            { icon:'🎓', label:'Matricule', val: user.matricule },
            { icon:'📧', label:'Email',     val: user.email },
            { icon:'🏛️', label:'Classe',    val: user.classe },
            { icon:'📚', label:'Filière',   val: user.filiere_label },
            { icon:'🎯', label:'Niveau',    val: user.niveau_label },
          ].filter(i => i.val).map((item, idx, arr) => (
            <View key={item.label}
              style={[st.infoRow, idx < arr.length - 1 && st.infoRowSep]}
            >
              <View style={st.infoIcoBox}>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.infoLbl}>{item.label}</Text>
                <Text style={st.infoVal}>{item.val}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Badges */}
      <View style={st.sec}>
        <Text style={st.secTitle}>Badges & Récompenses</Text>
        {badges.length === 0 ? (
          <View style={st.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🎯</Text>
            <Text style={st.emptyTxt}>Publiez des signalements pour gagner des badges</Text>
          </View>
        ) : (
          <View style={st.badgesRow}>
            {badges.map((b: string, i: number) => {
              const cfg = BADGE_MAP[b.trim()] || { icon:'🏅', label: b, color:'#64748b' };
              return (
                <View key={i} style={[st.badgeCard, { borderColor: cfg.color + '40' }]}>
                  <View style={[st.badgeIcoBox, { backgroundColor: cfg.color + '20' }]}>
                    <Text style={{ fontSize: 24 }}>{cfg.icon}</Text>
                  </View>
                  <Text style={[st.badgeLbl, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Déconnexion */}
      <View style={st.sec}>
        <TouchableOpacity style={st.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={{ fontSize: 20 }}>🚪</Text>
          <Text style={st.logoutTxt}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </Animated.ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB NOTES
// ══════════════════════════════════════════════════════════════════════
function TabNotes({ token }: { token: string }) {
  const [notes, setNotes]       = useState<any[]>([]);
  const [moyennes, setMoyennes] = useState<Record<string,number>>({});
  const [moyGen, setMoyGen]     = useState<number|null>(null);
  const [analyse, setAnalyse]   = useState<any>(null);
  const [selSem, setSelSem]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      // GET /notes → [{id, matiere, note, semestre}]
      const r1 = await fetch(ENDPOINTS.notes, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (r1.ok) {
        const data: any[] = await r1.json();
        setNotes(data);
        const sems = [...new Set(data.map((n: any) => n.semestre))].sort();
        if (sems.length > 0 && !selSem) setSelSem(sems[0]);
      }

      // GET /notes/moyenne → {moyennes: {S1: x}, moyenne_generale: y}
      const r2 = await fetch(ENDPOINTS.moyenne, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (r2.ok) {
        const m = await r2.json();
        setMoyennes(m.moyennes || {});
        setMoyGen(m.moyenne_generale ?? null);
      }

      // GET /notes/analyse → {analyse_ia, moyennes_par_matiere, ...}
      const r3 = await fetch(ENDPOINTS.analyseNotes, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (r3.ok) {
        const a = await r3.json();
        setAnalyse(a);
      }
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token, selSem]);

  useEffect(() => { load(); }, [token]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const semestres    = [...new Set(notes.map((n: any) => n.semestre))].sort();
  const notesDuSem   = notes.filter((n: any) => n.semestre === selSem);
  const moyLocale    = moyennes[selSem] ?? null;
  const mention      = moyGen !== null ? getMention(Number(moyGen)) : null;

  if (loading) return (
    <View style={st.center}><ActivityIndicator color="#1d4ed8" size="large" /></View>
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d4ed8" />}
    >
      {/* Hero moyenne */}
      <View style={st.notesHero}>
        <View style={{ flex: 1.5 }}>
          <Text style={st.notesMoyLbl}>Moyenne générale</Text>
          <Text style={[st.notesMoyVal, { color: mention?.color || '#f1f5f9' }]}>
            {moyGen !== null ? Number(moyGen).toFixed(2) : '--'}
            <Text style={st.notesMoySuf}>/20</Text>
          </Text>
          {mention && (
            <View style={[st.mentionBadge, { backgroundColor: mention.color + '25' }]}>
              <Text style={[st.mentionTxt, { color: mention.color }]}>{mention.label}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={st.notesSideBox}>
            <Text style={st.notesSideVal}>{notes.length}</Text>
            <Text style={st.notesSideLbl}>Notes</Text>
          </View>
          <View style={st.notesSideBox}>
            <Text style={[st.notesSideVal, { color: '#10b981' }]}>
              {moyLocale !== null ? Number(moyLocale).toFixed(1) : '--'}
            </Text>
            <Text style={st.notesSideLbl}>{selSem || 'Ce sem.'}</Text>
          </View>
        </View>
      </View>

      

      {/* Analyse IA */}
      {analyse?.analyse_ia ? (
        <View style={st.sec}>
          <View style={st.iaCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 22 }}>🤖</Text>
              <Text style={st.iaTitre}>Analyse IA de vos performances</Text>
            </View>

            {/* niveau */}
            {analyse.analyse_ia.niveau ? (
              <Text style={[st.iaTxt, { fontWeight: '700', marginBottom: 6 }]}>
                📊 Niveau : {String(analyse.analyse_ia.niveau)}
              </Text>
            ) : null}

            {/* tendance */}
            {analyse.analyse_ia.tendance ? (
              <Text style={[st.iaTxt, { marginBottom: 6 }]}>
                📈 Tendance : {String(analyse.analyse_ia.tendance)}
              </Text>
            ) : null}

            {/* message global */}
            {analyse.analyse_ia.message_global ? (
              <Text style={[st.iaTxt, { marginBottom: 8 }]}>
                {String(analyse.analyse_ia.message_global)}
              </Text>
            ) : null}

            {/* points forts */}
            {Array.isArray(analyse.analyse_ia.points_forts) && analyse.analyse_ia.points_forts.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={[st.iaTxt, { fontWeight: '700', color: '#10b981', marginBottom: 4 }]}>
                  ✅ Points forts :
                </Text>
                {analyse.analyse_ia.points_forts.map((p: any, i: number) => (
                  <Text key={i} style={[st.iaTxt, { color: '#10b981', marginBottom: 2 }]}>
                    • {String(p)}
                  </Text>
                ))}
              </View>
            ) : null}

            {/* points faibles */}
            {Array.isArray(analyse.analyse_ia.points_faibles) && analyse.analyse_ia.points_faibles.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={[st.iaTxt, { fontWeight: '700', color: '#f87171', marginBottom: 4 }]}>
                  ⚠️ Points faibles :
                </Text>
                {analyse.analyse_ia.points_faibles.map((p: any, i: number) => (
                  <Text key={i} style={[st.iaTxt, { color: '#f87171', marginBottom: 2 }]}>
                    • {String(p)}
                  </Text>
                ))}
              </View>
            ) : null}

            {/* recommandations — chaque item est {type, message} */}
            {Array.isArray(analyse.analyse_ia.recommandations) && analyse.analyse_ia.recommandations.length > 0 ? (
              <View>
                <Text style={[st.iaTxt, { fontWeight: '700', marginBottom: 6 }]}>
                  💡 Recommandations :
                </Text>
                {analyse.analyse_ia.recommandations.map((r: any, i: number) => (
                  <Text key={i} style={[st.iaTxt, { marginBottom: 4 }]}>
                    • {typeof r === 'object' ? String(r.message || r.type || JSON.stringify(r)) : String(r)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Sélecteur semestre */}
      {semestres.length > 0 && (
        <View style={st.sec}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {semestres.map((sem: string) => (
              <TouchableOpacity
                key={sem}
                style={[st.semChip, selSem === sem && st.semChipOn]}
                onPress={() => setSelSem(sem)}
              >
                <Text style={[st.semChipTxt, selSem === sem && st.semChipTxtOn]}>{sem}</Text>
                {moyennes[sem] !== undefined && (
                  <Text style={{ fontSize: 11, fontWeight: '800', color: selSem === sem ? '#bfdbfe' : '#64748b' }}>
                    {' '}{Number(moyennes[sem]).toFixed(1)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Notes */}
      <View style={st.sec}>
        <Text style={st.secTitle}>
          {selSem ? `Notes — ${selSem}` : 'Toutes les notes'}
          {moyLocale !== null ? `  ·  Moy: ${Number(moyLocale).toFixed(2)}/20` : ''}
        </Text>
        {notesDuSem.length === 0 ? (
          <View style={st.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📝</Text>
            <Text style={st.emptyTxt}>
              {semestres.length === 0
                ? 'Aucune note disponible'
                : `Aucune note pour ${selSem}`}
            </Text>
            <Text style={[st.emptyTxt, { fontSize: 12, marginTop: 4 }]}>
              Les notes sont publiées par l'administration
            </Text>
          </View>
        ) : (
          notesDuSem.map((note: any, idx: number) => {
            const val = Number(note.note);
            const col = noteColor(val);
            const pct = (val / 20) * 100;
            return (
              <View key={note.id || idx} style={st.noteCard}>
                <View style={{ flex: 1 }}>
                  <Text style={st.noteMatiere}>{note.matiere}</Text>
                  <Text style={st.noteSem}>{note.semestre}</Text>
                  <View style={st.noteBarTrack}>
                    <View style={[st.noteBarFill, { width: `${pct}%` as any, backgroundColor: col }]} />
                  </View>
                </View>
                <View style={[st.noteCircle, { borderColor: col }]}>
                  <Text style={[st.noteValTxt, { color: col }]}>{val}</Text>
                  <Text style={st.noteDenom}>/20</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SEANCE CARD
// ══════════════════════════════════════════════════════════════════════
function SeanceCard({ sc }: { sc: any }) {
  const statut = STATUT_SEANCE[sc.statut] || STATUT_SEANCE.programme;
  const isAnnule = sc.statut === 'annule';
  const SITE_COLORS: Record<string,string> = {
    AFITECH: '#1d4ed8', AFI_SIEGE: '#059669', LYCEE: '#7c3aed', default: '#64748b'
  };
  const siteColor = SITE_COLORS[sc.site] || SITE_COLORS.default;
  return (
    <View style={[st.seanceCard, isAnnule && { opacity: 0.55 }]}>
      <View style={[st.seanceAccent, { backgroundColor: siteColor }]} />
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={st.seanceHeure}>{sc.heure || '--:--'}</Text>
            <Text style={st.seanceDuree}>{sc.duree}h</Text>
          </View>
          <View style={[st.seanceStatut, { backgroundColor: statut.bg }]}>
            <Text style={[st.seanceStatutTxt, { color: statut.color }]}>{statut.label}</Text>
          </View>
        </View>
        <Text style={[st.seanceMod, isAnnule && { textDecorationLine: 'line-through', color: '#64748b' }]}>
          {sc.module || sc.ue}
        </Text>
        {sc.ue && sc.ue !== sc.module ? <Text style={st.seanceUE}>{sc.ue}</Text> : null}
        <View style={st.seanceMeta}>
          {sc.prof     ? <Text style={st.seanceMetaTxt}>👨‍🏫 {sc.prof}</Text> : null}
          {sc.salle     ? <Text style={st.seanceMetaTxt}>📍 {sc.salle}</Text> : null}
          {sc.site      ? <Text style={st.seanceMetaTxt}>🏛️ {sc.site.replace('_', ' ')}</Text> : null}
          {sc.date      ? <Text style={st.seanceMetaTxt}>📅 {sc.date}</Text> : null}
        </View>
        {sc.note ? (
          <View style={st.seanceNote}>
            <Text style={{ fontSize: 13 }}>ℹ️</Text>
            <Text style={st.seanceNoteTxt}>{sc.note}</Text>
          </View>
        ) : null}
        {sc.heures_prevues > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={st.heuresTxt}>{sc.heures_faites}h / {sc.heures_prevues}h effectuées</Text>
            <View style={st.heuresTrack}>
              <View style={[st.heuresFill, {
                width: `${Math.min((sc.heures_faites / sc.heures_prevues) * 100, 100)}%` as any
              }]} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB EDT
// ══════════════════════════════════════════════════════════════════════
function TabEDT({ token }: { token: string }) {
  const [seances, setSeances]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classe, setClasse]     = useState('');
  const [viewMode, setViewMode] = useState<'jour'|'semaine'|'mois'>('jour');
  const today = new Date();
  const todayDow = today.getDay();
  const defaultJourIdx = todayDow >= 1 && todayDow <= 6 ? todayDow - 1 : 0;
  const [jourIdx, setJourIdx]         = useState(defaultJourIdx);
  const [semaineOffset, setSemaineOffset] = useState(0);
  const [moisOffset, setMoisOffset]   = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const cached = await AsyncStorage.getItem('user');
      if (!cached) return;
      const u = JSON.parse(cached);
      const cl = u.classe || '';
      setClasse(cl);
      if (!cl) return;
      const res = await fetch(ENDPOINTS.planning(cl), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSeances(Array.isArray(data) ? data : []);
      }
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [token]);
  const onRefresh = () => { setRefreshing(true); load(true); };

  function getWeekStart(offset = 0) {
    const d = new Date();
    const dow = d.getDay() || 7;
    d.setDate(d.getDate() - dow + 1 + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function filterSeances() {
    if (viewMode === 'jour') {
      return seances.filter(s => {
        if (!s.date) return false;
        const dow = new Date(s.date).getDay();
        return dow === jourIdx + 1;
      }).sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
    }
    if (viewMode === 'semaine') {
      const ws = getWeekStart(semaineOffset);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return seances.filter(s => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d >= ws && d <= we;
      }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.heure || '').localeCompare(b.heure || ''));
    }
    if (viewMode === 'mois') {
      const ref = new Date();
      ref.setMonth(ref.getMonth() + moisOffset);
      return seances.filter(s => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
      }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.heure || '').localeCompare(b.heure || ''));
    }
    return [];
  }

  function getNavLabel() {
    if (viewMode === 'jour') return JOURS_FULL[jourIdx];
    if (viewMode === 'semaine') {
      const ws = getWeekStart(semaineOffset);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return `${ws.getDate()} ${MOIS_FR[ws.getMonth()]} — ${we.getDate()} ${MOIS_FR[we.getMonth()]}`;
    }
    const ref = new Date(); ref.setMonth(ref.getMonth() + moisOffset);
    const MOIS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    return `${MOIS_FULL[ref.getMonth()]} ${ref.getFullYear()}`;
  }

  function navPrev() {
    if (viewMode === 'jour')    setJourIdx(i => Math.max(0, i - 1));
    if (viewMode === 'semaine') setSemaineOffset(o => o - 1);
    if (viewMode === 'mois')    setMoisOffset(o => o - 1);
  }
  function navNext() {
    if (viewMode === 'jour')    setJourIdx(i => Math.min(5, i + 1));
    if (viewMode === 'semaine') setSemaineOffset(o => o + 1);
    if (viewMode === 'mois')    setMoisOffset(o => o + 1);
  }
  function navReset() {
    setJourIdx(defaultJourIdx);
    setSemaineOffset(0);
    setMoisOffset(0);
  }

  function groupByDate(scs: any[]) {
    const groups: Record<string, any[]> = {};
    for (const sc of scs) {
      const key = sc.date || 'Sans date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(sc);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }

  function formatDate(dateStr: string) {
    if (!dateStr || dateStr === 'Sans date') return 'Sans date';
    const d = new Date(dateStr);
    const dow = JOURS_FULL[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const MOIS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    return `${dow} ${d.getDate()} ${MOIS_FULL[d.getMonth()]}`;
  }

  const seancesFiltrees = filterSeances();

  return (
    <View style={{ flex: 1 }}>
      {/* Sélecteur vue */}
      <View style={st.viewModeSel}>
        {(['jour','semaine','mois'] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[st.viewModeBtn, viewMode === m && st.viewModeBtnOn]}
            onPress={() => setViewMode(m)}
          >
            <Text style={[st.viewModeTxt, viewMode === m && st.viewModeTxtOn]}>
              {m === 'jour' ? '📅 Jour' : m === 'semaine' ? '📆 Semaine' : '🗓️ Mois'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sélecteur jours (mode Jour) */}
      {viewMode === 'jour' && (
        <View style={st.jourSelector}>
          {JOURS_SHORT.map((j, idx) => {
            const isToday  = idx === defaultJourIdx;
            const isActive = idx === jourIdx;
            return (
              <TouchableOpacity
                key={j}
                style={[st.jourBtn, isActive && st.jourBtnOn]}
                onPress={() => setJourIdx(idx)}
              >
                <Text style={[st.jourShort, isActive && st.jourShortOn]}>{j}</Text>
                {isToday && <View style={st.todayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Barre navigation */}
      <View style={st.navBar}>
        <TouchableOpacity style={st.navArrow} onPress={navPrev}>
          <Text style={st.navArrowTxt}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={navReset} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={st.navLabel}>{getNavLabel()}</Text>
          {(semaineOffset !== 0 || moisOffset !== 0 ||
            (viewMode === 'jour' && jourIdx !== defaultJourIdx)) && (
            <Text style={st.navReset}>Revenir à aujourd'hui</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={st.navArrow} onPress={navNext}>
          <Text style={st.navArrowTxt}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color="#1d4ed8" size="large" /></View>
      ) : !classe ? (
        <View style={st.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🏛️</Text>
          <Text style={st.emptyTxt}>Aucune classe associée à votre profil</Text>
          <Text style={[st.emptyTxt, { fontSize: 12, marginTop: 4 }]}>Contactez l'administration</Text>
        </View>
      ) : seancesFiltrees.length === 0 ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d4ed8" />}
        >
          <View style={[st.center, { flex: 0, paddingVertical: 60 }]}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>😴</Text>
            <Text style={st.emptyTxt}>Aucun cours pour cette période</Text>
            <Text style={[st.emptyTxt, { fontSize: 12, marginTop: 4 }]}>
              {seances.length === 0
                ? "Le planning sera publié par l'administration"
                : 'Profitez de votre temps libre !'}
            </Text>
          </View>
        </ScrollView>
      ) : viewMode === 'jour' ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d4ed8" />}
        >
          {seancesFiltrees.map((sc: any, idx: number) => (
            <SeanceCard key={sc.id || idx} sc={sc} />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d4ed8" />}
        >
          {groupByDate(seancesFiltrees).map(([date, scs]) => (
            <View key={date} style={{ marginBottom: 20 }}>
              <View style={st.dateHeader}>
                <Text style={st.dateHeaderTxt}>{formatDate(date)}</Text>
                <Text style={st.dateHeaderCount}>{scs.length} cours</Text>
              </View>
              {scs.map((sc: any, i: number) => (
                <SeanceCard key={sc.id || i} sc={sc} />
              ))}
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'profil', label: 'Profil',          icon: '👤' },
  { key: 'notes',  label: 'Notes',           icon: '📊' },
  { key: 'edt',    label: 'Emploi du temps', icon: '📅' },
];

export default function MonEspace() {
  const [activeTab, setActiveTab] = useState('profil');
  const [token, setToken]         = useState('');
  const [user, setUser]           = useState<any>(null);
  const indicAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('token').then(t => setToken(t || ''));
    AsyncStorage.getItem('user').then(u => { if (u) setUser(JSON.parse(u)); });
  }, []);

  const switchTab = (key: string, idx: number) => {
    setActiveTab(key);
    Animated.spring(indicAnim, { toValue: idx, tension: 60, friction: 10, useNativeDriver: true }).start();
  };

  return (
    <View style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>Mon Espace</Text>
          {user && (
            <Text style={st.headerSub}>{user.prenom} {user.nom} · {user.matricule}</Text>
          )}
        </View>
        {user && (
          <View style={[st.headerAvatar, { backgroundColor: hashColor((user.prenom||'')+(user.nom||'')) }]}>
            <Text style={st.headerAvatarTxt}>{getInitials(user.prenom||'', user.nom||'')}</Text>
          </View>
        )}
      </View>

      {/* Tab Bar */}
      <View style={st.tabBar}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab.key}
            style={st.tabBtn}
            onPress={() => switchTab(tab.key, idx)}
            activeOpacity={0.7}
          >
            <Text style={st.tabIco}>{tab.icon}</Text>
            <Text style={[st.tabLbl, activeTab === tab.key && st.tabLblOn]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
        <Animated.View style={[st.tabIndicator, {
          width: `${100 / TABS.length}%` as any,
          transform: [{
            translateX: indicAnim.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [0, 120, 240],
            })
          }]
        }]} />
      </View>

      {/* Contenu */}
      <View style={{ flex: 1, backgroundColor: '#0a0f1e' }}>
        {activeTab === 'profil' && <TabProfil token={token} />}
        {activeTab === 'notes'  && <TabNotes  token={token} />}
        {activeTab === 'edt'    && <TabEDT    token={token} />}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// STYLES — complet sans coupure
// ══════════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0f1e' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1e' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#f1f5f9', letterSpacing: -0.5 },
  headerSub:  { fontSize: 13, color: '#475569', marginTop: 3 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  headerAvatarTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  tabBar:     { flexDirection: 'row', backgroundColor: '#111827', borderBottomWidth: 1, borderBottomColor: '#1e293b', position: 'relative' },
  tabBtn:     { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  tabIco:     { fontSize: 18 },
  tabLbl:     { fontSize: 11, color: '#475569', fontWeight: '600' },
  tabLblOn:   { color: '#3b82f6' },
  tabIndicator: { position: 'absolute', bottom: 0, height: 2, backgroundColor: '#3b82f6', borderRadius: 1 },
  hero:       { alignItems: 'center', paddingTop: 32, paddingBottom: 28, paddingHorizontal: 20, backgroundColor: '#111827' },
  heroBg:     { position: 'absolute', top: 0, left: 0, right: 0, height: 80, backgroundColor: '#1d4ed815' },
  heroAvatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#1e293b', marginBottom: 14, position: 'relative' },
  heroAvatarTxt: { color: '#fff', fontWeight: '900', fontSize: 30 },
  adminDot:   { position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#111827' },
  heroName:   { fontSize: 22, fontWeight: '900', color: '#f1f5f9', marginBottom: 4 },
  heroClasse: { fontSize: 14, color: '#3b82f6', fontWeight: '700', marginBottom: 2 },
  heroFiliere: { fontSize: 13, color: '#64748b' },
  heroNiveau: { fontSize: 13, color: '#475569', marginTop: 2 },
  adminBadge: { marginTop: 10, backgroundColor: '#7c3aed', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  adminBadgeTxt: { fontSize: 11, color: '#fff', fontWeight: '800', letterSpacing: 1 },
  statsRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 16 },
  statBox:    { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b', position: 'relative', overflow: 'hidden' },
  statVal:    { fontSize: 24, fontWeight: '900', color: '#3b82f6', lineHeight: 28 },
  statLbl:    { fontSize: 10, color: '#475569', marginTop: 4, fontWeight: '600', textAlign: 'center' },
  statIco:    { position: 'absolute', top: 8, right: 8, fontSize: 14, opacity: 0.35 },
  sec:        { paddingHorizontal: 16, marginBottom: 16 },
  secTitle:   { fontSize: 13, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  xpCard:     { backgroundColor: '#111827', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  xpTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  xpNiv:      { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  xpSub:      { fontSize: 12, color: '#475569', marginTop: 4 },
  xpBadge:    { backgroundColor: '#1d4ed820', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  xpBadgeTxt: { fontSize: 14, color: '#3b82f6', fontWeight: '900' },
  xpTrack:    { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' },
  xpFill:     { height: 8, backgroundColor: '#1d4ed8', borderRadius: 4 },
  xpLevels:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xpLevelTxt: { fontSize: 11, color: '#334155', fontWeight: '600' },
  infoCard:   { backgroundColor: '#111827', borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  infoRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  infoRowSep: { borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  infoIcoBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  infoLbl:    { fontSize: 11, color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoVal:    { fontSize: 15, color: '#f1f5f9', fontWeight: '600', marginTop: 2 },
  badgesRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:  { backgroundColor: '#111827', borderRadius: 16, padding: 14, alignItems: 'center', minWidth: 100, borderWidth: 1, flex: 1 },
  badgeIcoBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  badgeLbl:   { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
  emptyCard:  { backgroundColor: '#111827', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  emptyTxt:   { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20 },
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7f1d1d20', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#7f1d1d40' },
  logoutTxt:  { fontSize: 15, color: '#fca5a5', fontWeight: '700' },
  notesHero:  { flexDirection: 'row', margin: 16, backgroundColor: '#111827', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e293b', gap: 16 },
  notesMoyLbl: { fontSize: 11, color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  notesMoyVal: { fontSize: 48, fontWeight: '900', color: '#f1f5f9', lineHeight: 52 },
  notesMoySuf: { fontSize: 20, color: '#475569', fontWeight: '600' },
  mentionBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  mentionTxt: { fontSize: 13, fontWeight: '800' },
  notesSideBox: { backgroundColor: '#0a0f1e', borderRadius: 14, padding: 12, alignItems: 'center', flex: 1 },
  notesSideVal: { fontSize: 22, fontWeight: '900', color: '#3b82f6' },
  notesSideLbl: { fontSize: 10, color: '#475569', marginTop: 3, fontWeight: '600', textAlign: 'center' },
  iaCard:     { backgroundColor: '#1e1b4b', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#3730a3' },
  iaTitre:    { fontSize: 14, fontWeight: '800', color: '#a5b4fc' },
  iaTxt:      { fontSize: 14, color: '#c7d2fe', lineHeight: 22 },
  semChip:    { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b', marginRight: 8, flexDirection: 'row', alignItems: 'center' },
  semChipOn:  { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  semChipTxt: { fontSize: 13, color: '#475569', fontWeight: '700' },
  semChipTxtOn: { color: '#fff' },
  noteCard:   { backgroundColor: '#111827', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center', gap: 16 },
  noteMatiere: { fontSize: 15, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
  noteSem:    { fontSize: 11, color: '#475569', marginBottom: 8, fontWeight: '600' },
  noteBarTrack: { height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  noteBarFill: { height: 4, borderRadius: 2 },
  noteCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1e' },
  noteValTxt: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  noteDenom:  { fontSize: 10, color: '#475569', fontWeight: '600' },
  viewModeSel: { flexDirection: 'row', backgroundColor: '#111827', padding: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  viewModeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: '#0a0f1e' },
  viewModeBtnOn: { backgroundColor: '#1d4ed8' },
  viewModeTxt: { fontSize: 12, color: '#475569', fontWeight: '700' },
  viewModeTxtOn: { color: '#fff' },
  jourSelector: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  jourBtn:    { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, position: 'relative' },
  jourBtnOn:  { backgroundColor: '#1d4ed8' },
  jourShort:  { fontSize: 13, fontWeight: '700', color: '#475569' },
  jourShortOn: { color: '#fff' },
  todayDot:   { position: 'absolute', bottom: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#10b981' },
  navBar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  navArrow:   { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  navArrowTxt: { fontSize: 20, color: '#94a3b8', fontWeight: '800' },
  navLabel:   { fontSize: 15, fontWeight: '800', color: '#f1f5f9', textAlign: 'center' },
  navReset:   { fontSize: 11, color: '#3b82f6', marginTop: 2, textAlign: 'center' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  dateHeaderTxt: { fontSize: 14, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateHeaderCount: { fontSize: 12, color: '#475569', fontWeight: '600' },
  seanceCard: { backgroundColor: '#111827', borderRadius: 18, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  seanceAccent: { width: 4 },
  seanceHeure: { fontSize: 16, fontWeight: '900', color: '#f1f5f9' },
  seanceDuree: { fontSize: 11, color: '#475569', fontWeight: '600', marginTop: 1 },
  seanceStatut: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  seanceStatutTxt: { fontSize: 11, fontWeight: '800' },
  seanceMod:  { fontSize: 16, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
  seanceUE:   { fontSize: 12, color: '#64748b', marginBottom: 8 },
  seanceMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  seanceMetaTxt: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  seanceNote: { flexDirection: 'row', gap: 6, marginTop: 10, backgroundColor: '#0a0f1e', borderRadius: 8, padding: 8 },
  seanceNoteTxt: { fontSize: 12, color: '#94a3b8', flex: 1, lineHeight: 18 },
  heuresTxt:  { fontSize: 11, color: '#475569', marginBottom: 4, fontWeight: '600' },
  heuresTrack: { height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  heuresFill: { height: 4, backgroundColor: '#1d4ed8', borderRadius: 2 },
});
