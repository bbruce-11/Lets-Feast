import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { REWARDS_POINTS } from '@/constants/profile';

interface RowProps { icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean; noBorder?: boolean }
function Row({ icon, label, value, onPress, danger = false, noBorder = false }: RowProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, !noBorder && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon as any} size={22} color={danger ? colors.destructive : colors.foreground} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      </View>
      {value ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]} numberOfLines={1}>{value}</Text> : null}
      {onPress && !danger && <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

function ContactRow({ icon, value }: { icon: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon as any} size={16} color={colors.mutedForeground} />
      <Text style={[styles.contactText, { color: colors.mutedForeground }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useApp();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const handleSignOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/index' as any); } },
    ]);
  };

  const membership = user?.membershipStatus ? `${user.membershipStatus.toUpperCase()} MEMBER` : 'FREE MEMBER';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '12' }]}>
            <Text style={[styles.avatarInitials, { color: colors.primary }]}>
              {(user?.fullName ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
              {user?.fullName ?? 'Feast Member'}
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.gold + '20' }]}>
              <Ionicons name="star" size={12} color={colors.gold} />
              <Text style={[styles.badgeText, { color: colors.gold }]}>{membership}</Text>
            </View>
          </View>
        </View>

        {/* Contact + rewards summary */}
        <View style={styles.content}>
          <View style={[styles.card, styles.summaryCard, { backgroundColor: colors.card }]}>
            {user?.email ? <ContactRow icon="mail-outline" value={user.email} /> : null}
            {user?.phone ? <ContactRow icon="call-outline" value={user.phone} /> : null}
            <TouchableOpacity
              style={[styles.rewardsSummary, { backgroundColor: colors.gold + '12' }]}
              onPress={() => router.push('/profile/rewards' as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Feast Rewards"
            >
              <Ionicons name="gift" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rewardsValue, { color: colors.foreground }]}>{REWARDS_POINTS} pts</Text>
                <Text style={[styles.rewardsLabel, { color: colors.mutedForeground }]}>Feast Rewards balance</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Row icon="card-outline" label="Payment Methods" onPress={() => router.push('/profile/payment-methods' as any)} />
            <Row icon="options-outline" label="Food Preferences" onPress={() => router.push('/profile/food-preferences' as any)} />
            <Row icon="location-outline" label="Addresses" value={user?.savedAddresses?.[0]?.label ?? 'Add an address'} onPress={() => router.push('/address' as any)} noBorder />
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Row icon="receipt-outline" label="Order History" onPress={() => router.push('/order-history' as any)} />
            <Row icon="star-outline" label="Feast Rewards" value={`${REWARDS_POINTS} pts`} onPress={() => router.push('/profile/rewards' as any)} noBorder />
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Row icon="settings-outline" label="Settings" onPress={() => router.push('/profile/settings' as any)} />
            <Row icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/profile/help-support' as any)} />
            <Row icon="log-out-outline" label="Log Out" onPress={handleSignOut} danger noBorder />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  profileInfo: { flex: 1, gap: 6 },
  userName: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  content: { paddingHorizontal: 20, gap: 20 },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCard: { padding: 16, gap: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },
  rewardsSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginTop: 2 },
  rewardsValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  rewardsLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  rowIconWrap: { width: 32, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  rowValue: { fontSize: 14, fontFamily: 'Inter_400Regular', marginRight: 4 },
});
