import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/signin');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.navy }]}>{user?.fullName ?? 'Account'}</Text>
        <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
      </View>

      <TouchableOpacity
        onPress={handleSignOut}
        style={[styles.signOutButton, { borderColor: colors.border }]}
      >
        <Text style={{ color: colors.destructive, fontWeight: '600' }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  header: { marginBottom: 32 },
  name: { fontSize: 24, fontWeight: '700' },
  email: { fontSize: 14, marginTop: 4 },
  signOutButton: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
});
