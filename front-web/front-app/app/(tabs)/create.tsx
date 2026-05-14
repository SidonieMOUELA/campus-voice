
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';
import { ENDPOINTS } from '../../constants/api';

const CATEGORIES = [
  'WiFi / Réseau', 'Climatisation', 'Électricité', 'Vidéoprojecteur',
  'Sécurité', 'Propreté', 'Administration', 'Cafétéria', 'Eau', 'Transport', 'Autre'
];

const BLOCS = [
  'Siège', 'AFI-Tech', 'Lycée', 'Bibliothèque', 'Cafétéria',
  'Amphi 1', 'Amphi 2', 'Bloc A', 'Bloc B', 'Bloc C', 'Labo Info'
];

// ── Dropdown ──────────────────────────────────────────────────────────
function Dropdown({ label, value, options, onSelect, placeholder }: any) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label} <Text style={s.req}>*</Text></Text>
      <TouchableOpacity style={s.dropBtn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={value ? s.dropOn : s.dropOff}>{value || placeholder}</Text>
        <Text style={s.dropArrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={s.sheet}>
            <View style={s.sheetBar} />
            <Text style={s.sheetTitle}>{label}</Text>
            <ScrollView bounces={false}>
              {options.map((opt: string) => (
                <TouchableOpacity
                  key={opt}
                  style={[s.sheetRow, value === opt && s.sheetRowOn]}
                  onPress={() => { onSelect(opt); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.sheetRowTxt, value === opt && s.sheetRowTxtOn]}>{opt}</Text>
                  {value === opt && <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '800' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Modal Micro ───────────────────────────────────────────────────────
function MicModal({ visible, onClose, onTranscribed }: any) {
  const [recording, setRecording]   = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [secs, setSecs]             = useState(0);
  const timerRef  = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => Animated.loop(Animated.sequence([
    Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
    Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
  ])).start();

  const stopPulse = () => { pulseAnim.stopAnimation(); pulseAnim.setValue(1); };

  const fmt = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}`;

  const handleClose = () => {
    stopPulse();
    clearInterval(timerRef.current);
    if (recording) { recording.stopAndUnloadAsync().catch(() => {}); setRecording(null); }
    setIsRecording(false); setTranscribing(false); setSecs(0);
    onClose();
  };

  const startRec = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('Permission refusée', 'Autorise le micro dans les paramètres'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec); setIsRecording(true); setSecs(0); startPulse();
      timerRef.current = setInterval(() => setSecs(t => t + 1), 1000);
    } catch { Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement'); }
  };

  const stopRec = async () => {
    if (!recording) return;
    clearInterval(timerRef.current); stopPulse();
    setIsRecording(false); setTranscribing(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); setRecording(null);
      if (uri) {
        const token = await AsyncStorage.getItem('token');
        const form = new FormData();
        form.append('audio', { uri, type: 'audio/m4a', name: 'rec.m4a' } as any);
        const res = await fetch(ENDPOINTS.transcription, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form,
        });
        if (res.ok) {
          const d = await res.json();
          onTranscribed(d.texte || d.text || d.transcription || '');
          handleClose();
        } else {
          Alert.alert('Erreur', 'Transcription échouée');
          setTranscribing(false);
        }
      }
    } catch { Alert.alert('Erreur réseau', 'Impossible de transcrire'); setTranscribing(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.micOverlay}>
        <View style={s.micSheet}>
          <View style={s.sheetBar} />
          <Text style={s.micTitle}>
            {transcribing ? 'Transcription...' : isRecording ? 'Enregistrement' : 'Signalement vocal'}
          </Text>
          <Text style={s.micSub}>
            {transcribing ? 'L\'IA Whisper convertit votre voix en texte'
              : isRecording ? `Parlez clairement · ${fmt(secs)}`
              : 'Décrivez votre problème à voix haute'}
          </Text>

          <View style={s.micCenter}>
            {isRecording && (
              <Animated.View style={[s.micHalo, { transform: [{ scale: pulseAnim }] }]} />
            )}
            <TouchableOpacity
              style={[
                s.micBigBtn,
                isRecording  && s.micBigBtnRec,
                transcribing && s.micBigBtnLoad,
              ]}
              onPress={isRecording ? stopRec : startRec}
              disabled={transcribing}
              activeOpacity={0.85}
            >
              {transcribing
                ? <ActivityIndicator color="#fff" size="large" />
                : <Text style={s.micBigIco}>{isRecording ? '⏹' : '🎤'}</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={s.micHint}>
            {isRecording ? 'Appuie sur ⏹ pour terminer et transcrire'
              : transcribing ? 'Veuillez patienter...'
              : 'Appuie sur le micro pour commencer'}
          </Text>

          {!transcribing && (
            <TouchableOpacity style={s.micCancelBtn} onPress={handleClose}>
              <Text style={s.micCancelTxt}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Page principale ───────────────────────────────────────────────────
export default function Create() {
  const router   = useRouter();
  const descRef  = useRef<TextInput>(null);
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]     = useState('');
  const [bloc, setBloc]             = useState('');
  const [loading, setLoading]       = useState(false);
  const [showMic, setShowMic]       = useState(false);

  const reset = () => { setTitle(''); setDescription(''); setCategory(''); setBloc(''); };

  const handleTranscribed = (txt: string) => {
    setDescription(prev => prev ? `${prev} ${txt}` : txt);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !category || !bloc) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(ENDPOINTS.signalements, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          titre: title.trim(),
          description: description.trim(),
          categorie: category,
          localisation: bloc,
          type_publication: 'public',
          anonyme: false,
          visibilite: 'tous',
        }),
      });
      if (res.ok) {
        reset();
        router.replace('/(tabs)/feed');
      } else {
        const err = await res.json();
        Alert.alert('Erreur', err.detail || 'Problème lors de la publication');
      }
    } catch { Alert.alert('Erreur réseau', 'Vérifie ta connexion'); }
    finally { setLoading(false); }
  };

  const isValid = !!(title.trim() && description.trim() && category && bloc);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Nouveau signalement</Text>
          <Text style={s.pageSub}>Décrivez le problème rencontré sur le campus</Text>
        </View>

        {/* Champ Titre */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Titre du problème <Text style={s.req}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="Ex : WiFi en panne, clim défectueuse..."
            placeholderTextColor="#475569"
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            onSubmitEditing={() => descRef.current?.focus()}
          />
        </View>

        {/* Catégorie */}
        <Dropdown
          label="Catégorie"
          value={category}
          options={CATEGORIES}
          onSelect={setCategory}
          placeholder="Sélectionner une catégorie..."
        />

        {/* Lieu */}
        <Dropdown
          label="Lieu / Bloc"
          value={bloc}
          options={BLOCS}
          onSelect={setBloc}
          placeholder="Sélectionner un lieu..."
        />

        {/* Description avec bouton micro intégré dans le header */}
        <View style={s.fieldGroup}>
          <View style={s.descLabelRow}>
            <Text style={s.fieldLabel}>Description <Text style={s.req}>*</Text></Text>
            {/* Petit bouton micro discret aligné avec le label */}
            <TouchableOpacity
              style={s.micPill}
              onPress={() => setShowMic(true)}
              activeOpacity={0.8}
            >
              <Text style={s.micPillIco}>🎤</Text>
              <Text style={s.micPillTxt}>Saisie vocale</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.textareaBox, description.length > 0 && s.textareaBoxFilled]}>
            <TextInput
              ref={descRef}
              style={s.textarea}
              placeholder="Décrivez le problème : depuis quand, où exactement, impact sur les cours..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            {description.length > 0 && (
              <Text style={s.charCount}>{description.length} caractères</Text>
            )}
          </View>
        </View>

        {/* Tags résumé */}
        {(category || bloc) && (
          <View style={s.tagsRow}>
            {category && (
              <View style={s.tag}><Text style={s.tagTxt}>📌 {category}</Text></View>
            )}
            {bloc && (
              <View style={s.tag}><Text style={s.tagTxt}>📍 {bloc}</Text></View>
            )}
          </View>
        )}

        {/* Bouton publier */}
        <TouchableOpacity
          style={[s.submitBtn, !isValid && s.submitBtnOff]}
          onPress={handleSubmit}
          disabled={loading || !isValid}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={s.submitIco}>🚀</Text>
                <Text style={s.submitTxt}>Publier le signalement</Text>
              </>
          }
        </TouchableOpacity>

        {!isValid && (
          <Text style={s.hint}>Tous les champs marqués * sont obligatoires</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal micro */}
      <MicModal
        visible={showMic}
        onClose={() => setShowMic(false)}
        onTranscribed={handleTranscribed}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  scroll:    { padding: 20, paddingTop: 56, paddingBottom: 32 },

  pageHeader: { marginBottom: 32 },
  pageTitle:  { fontSize: 26, fontWeight: '900', color: '#f1f5f9', letterSpacing: -0.5 },
  pageSub:    { fontSize: 14, color: '#475569', marginTop: 6, lineHeight: 20 },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  req:        { color: '#ef4444' },

  input: {
    backgroundColor: '#111827', color: '#f1f5f9', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#1e293b', lineHeight: 22,
  },

  dropBtn: {
    backgroundColor: '#111827', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#1e293b',
  },
  dropOff:   { color: '#475569', fontSize: 15 },
  dropOn:    { color: '#f1f5f9', fontSize: 15, fontWeight: '500' },
  dropArrow: { color: '#475569', fontSize: 18 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '65%' },
  sheetBar:   { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#f1f5f9', marginBottom: 14 },
  sheetRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2 },
  sheetRowOn: { backgroundColor: '#1d4ed820' },
  sheetRowTxt:   { fontSize: 15, color: '#94a3b8' },
  sheetRowTxtOn: { color: '#3b82f6', fontWeight: '700' },

  // Description label row
  descLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },

  // Petit bouton micro pill — discret, aligné avec le label
  micPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1e293b', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#334155',
  },
  micPillIco: { fontSize: 13 },
  micPillTxt: { fontSize: 11, color: '#60a5fa', fontWeight: '700', letterSpacing: 0.3 },

  // Textarea
  textareaBox: {
    backgroundColor: '#111827', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden',
  },
  textareaBoxFilled: { borderColor: '#334155' },
  textarea: {
    color: '#f1f5f9', paddingHorizontal: 16,
    paddingTop: 14, paddingBottom: 40,
    fontSize: 15, minHeight: 150, lineHeight: 24,
    textAlignVertical: 'top',
  },
  charCount: { position: 'absolute', bottom: 10, right: 14, fontSize: 11, color: '#334155', fontWeight: '600' },

  // Tags résumé
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16, marginTop: -8 },
  tag:     { backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagTxt:  { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  // Submit
  submitBtn: {
    backgroundColor: '#1d4ed8', borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    marginTop: 4, shadowColor: '#1d4ed8', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  submitBtnOff: { backgroundColor: '#1e293b', shadowOpacity: 0, elevation: 0 },
  submitIco: { fontSize: 20 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  hint:      { fontSize: 12, color: '#334155', textAlign: 'center', marginTop: 12 },

  // Modal Micro
  micOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  micSheet:   {
    backgroundColor: '#111827', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: 44, paddingTop: 16, alignItems: 'center',
  },
  micTitle: { fontSize: 20, fontWeight: '900', color: '#f1f5f9', marginBottom: 8, marginTop: 4 },
  micSub:   { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 36, lineHeight: 20 },
  micCenter: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  micHalo:  { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#ef444430' },
  micBigBtn: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1d4ed8', shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  micBigBtnRec:  { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  micBigBtnLoad: { backgroundColor: '#334155', shadowOpacity: 0 },
  micBigIco:     { fontSize: 40 },
  micHint:  { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 32 },
  micCancelBtn: {
    backgroundColor: '#1e293b', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 48,
    borderWidth: 1, borderColor: '#334155',
  },
  micCancelTxt: { fontSize: 15, color: '#94a3b8', fontWeight: '700' },
});
