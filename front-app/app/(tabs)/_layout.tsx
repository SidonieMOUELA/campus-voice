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
      <Tabs.Screen name="news" options={{
        title: 'News',
        tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />
      }} />
      <Tabs.Screen name="espace" options={{
        title: 'Mon Espace',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />
      }} />
    </Tabs>
  );
}
