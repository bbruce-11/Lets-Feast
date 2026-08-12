import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {(user?.fullName ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.fullName ?? 'Account'}</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.menuGroup}>
        <MenuRow
          icon="receipt-outline"
          label="Order History"
          onPress={() => router.push('/orders')}
          colors={colors}
        />
      </View>

      <TouchableOpacity
        onPress={handleSignOut}
        style={[styles.signOutButton, { backgroundColor: colors.card }]}
        activeOpacity={0.85}
      >
        <Text style={{ color: colors.destructive, fontFamily: 'Inter_600SemiBold' }}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.menuRow, { backgroundColor: colors.card }]} activeOpacity={0.85}>
      <View style={[styles.menuIconWrap, { backgroundColor: colors.muted }]}>
        <Ionicons name={icon} size={18} color={colors.foreground} />
      </View>
      <Text style={[styles.menuRowText, { color: colors.foreground }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  email: { fontSize: 14, marginTop: 2, fontFamily: 'Inter_400Regular' },
  menuGroup: { gap: 10, marginBottom: 24 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  menuRowText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  signOutButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
});
