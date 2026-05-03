import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
      tabBarActiveTintColor: '#3b82f6',
      tabBarInactiveTintColor: '#64748b',
    }}>
      <Tabs.Screen name="feed" options={{
        title: 'Accueil',
        tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
      }} />
      <Tabs.Screen name="create" options={{
        title: 'Signaler',
        tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />
      }} />
      <Tabs.Screen name="edt" options={{
        title: 'Emploi du temps',
        tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profil',
        tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
      }} />
    </Tabs>
  );
}