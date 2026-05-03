import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const COURS_DEMO = [
  { id: '1', jour: 'Lundi',    heure: '08h00 - 10h00', matiere: 'Algorithmique',     salle: 'Salle 204', prof: 'M. Diallo',   couleur: '#3b82f6' },
  { id: '2', jour: 'Lundi',    heure: '10h00 - 12h00', matiere: 'Bases de données',  salle: 'Amphi 1',   prof: 'Mme. Traoré', couleur: '#8b5cf6' },
  { id: '3', jour: 'Mardi',    heure: '08h00 - 10h00', matiere: 'Réseaux',           salle: 'Labo Info', prof: 'M. Koné',     couleur: '#10b981' },
  { id: '4', jour: 'Mardi',    heure: '14h00 - 16h00', matiere: 'Mathématiques',     salle: 'Salle 101', prof: 'M. Touré',    couleur: '#f59e0b' },
  { id: '5', jour: 'Mercredi', heure: '10h00 - 12h00', matiere: 'Anglais Technique', salle: 'Salle 305', prof: 'Mme. Fall',   couleur: '#ef4444' },
  { id: '6', jour: 'Jeudi',    heure: '08h00 - 10h00', matiere: 'Algorithmique',     salle: 'Salle 204', prof: 'M. Diallo',   couleur: '#3b82f6' },
  { id: '7', jour: 'Jeudi',    heure: '14h00 - 17h00', matiere: 'Projet tutoré',     salle: 'Labo Info', prof: 'Équipe',      couleur: '#06b6d4' },
  { id: '8', jour: 'Vendredi', heure: '08h00 - 10h00', matiere: 'Bases de données',  salle: 'Amphi 1',   prof: 'Mme. Traoré', couleur: '#8b5cf6' },
  { id: '9', jour: 'Samedi',   heure: '08h00 - 12h00', matiere: 'Rattrapage / DS',   salle: 'Amphi 2',   prof: '-',           couleur: '#64748b' },
];

const JOURS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function EmploiDuTemps() {
  const today = new Date().getDay(); // 0=dim, 1=lun...
  const defaultIdx = today >= 1 && today <= 6 ? today - 1 : 0;
  const [jourActif, setJourActif] = useState(JOURS[defaultIdx]);

  const coursDuJour = COURS_DEMO.filter(c => c.jour === jourActif);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📅 Emploi du temps</Text>
        <Text style={styles.subtitle}>Semestre en cours</Text>
      </View>

      {/* Sélecteur de jours */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.joursScroll}
        contentContainerStyle={styles.joursContainer}
      >
        {JOURS.map((jour, idx) => (
          <TouchableOpacity
            key={jour}
            style={[styles.jourBtn, jourActif === jour && styles.jourBtnActif]}
            onPress={() => setJourActif(jour)}
          >
            <Text style={[styles.jourText, jourActif === jour && styles.jourTextActif]}>
              {JOURS_COURT[idx]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Titre du jour */}
      <Text style={styles.jourTitre}>{jourActif}</Text>

      {/* Liste des cours */}
      <ScrollView contentContainerStyle={styles.coursList}>
        {coursDuJour.length === 0 ? (
          <View style={styles.vide}>
            <Text style={styles.videText}>😴 Pas de cours ce jour</Text>
            <Text style={styles.videSubText}>Profite bien !</Text>
          </View>
        ) : (
          coursDuJour.map(cours => (
            <View key={cours.id} style={styles.coursCard}>
              <View style={[styles.coursAccent, { backgroundColor: cours.couleur }]} />
              <View style={styles.coursContent}>
                <Text style={styles.coursHeure}>{cours.heure}</Text>
                <Text style={styles.coursMatiere}>{cours.matiere}</Text>
                <View style={styles.coursInfoRow}>
                  <Text style={styles.coursInfo}>📍 {cours.salle}</Text>
                  <Text style={styles.coursInfo}>👨‍🏫 {cours.prof}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 56 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  joursScroll: { backgroundColor: '#1e293b', maxHeight: 60 },
  joursContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  jourBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: '#334155'
  },
  jourBtnActif: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  jourText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  jourTextActif: { color: '#fff' },
  jourTitre: {
    fontSize: 18, fontWeight: 'bold', color: '#f8fafc',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8
  },
  coursList: { padding: 16, gap: 12 },
  coursCard: {
    backgroundColor: '#1e293b', borderRadius: 14,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: '#334155'
  },
  coursAccent: { width: 5 },
  coursContent: { flex: 1, padding: 14 },
  coursHeure: { fontSize: 12, color: '#94a3b8', marginBottom: 4, fontWeight: '600' },
  coursMatiere: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc', marginBottom: 8 },
  coursInfoRow: { flexDirection: 'row', gap: 16 },
  coursInfo: { fontSize: 12, color: '#64748b' },
  vide: { alignItems: 'center', marginTop: 80 },
  videText: { fontSize: 20, color: '#f8fafc', fontWeight: 'bold' },
  videSubText: { fontSize: 14, color: '#64748b', marginTop: 8 },
});