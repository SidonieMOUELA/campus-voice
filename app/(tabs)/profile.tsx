import { StyleSheet, Text, View } from 'react-native';

export default function Profile() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>👤 Profil étudiant</Text>
      <Text style={styles.sub}>Bientôt disponible</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 22, color: '#f8fafc', fontWeight: 'bold' },
  sub: { fontSize: 14, color: '#64748b', marginTop: 8 },
});