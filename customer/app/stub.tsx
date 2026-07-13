import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const STUB_CONFIG: Record<string, { icon: string; gradient: [string, string]; desc: string }> = {
  'One Drink': { icon: 'beer', gradient: ['#A57D2D', '#7A5C20'], desc: 'Find bars, clubs, lounges, and member drink deals near you. Coming soon to your city.' },
  'Reserva': { icon: 'calendar', gradient: ['#89181A', '#5E1011'], desc: 'Book your table, pre-order your meal, and arrive like a regular. Coming soon.' },
  'Feast Catering': { icon: 'people', gradient: ['#475569', '#1E293B'], desc: 'Large group orders for offices, events, parties, and meetings. Launching soon.' },
  'Feast Grocery': { icon: 'leaf', gradient: ['#10B981', '#047857'], desc: 'Essentials, local goods, snacks, and drinks delivered to your door. Coming soon.' },
  'Feast 360': { icon: 'sparkles', gradient: ['#8B5CF6', '#5B21B6'], desc: 'Pop-up food experiences, live DJs, and cultural dining events. Opening soon near you.' },
  'Orders': { icon: 'receipt', gradient: ['#89181A', '#5E1011'], desc: 'View all your past Feast orders, reorder your favorites, and track status.' },
  'Favorites': { icon: 'heart', gradient: ['#89181A', '#5E1011'], desc: 'Your saved restaurants, menu items, and experiences in one place.' },
  'Membership': { icon: 'star', gradient: ['#A57D2D', '#7A5C20'], desc: 'Upgrade to Feast Gold or Platinum for exclusive deals, free delivery, and more.' },
  'Rewards': { icon: 'gift', gradient: ['#A57D2D', '#7A5C20'], desc: 'Earn points with every order and redeem for credits, discounts, and experiences.' },
  'Help': { icon: 'help-circle', gradient: ['#6B7280', '#374151'], desc: 'FAQs, live chat support, feedback, and account help.' },
  'Settings': { icon: 'settings', gradient: ['#6B7280', '#374151'], desc: 'Manage notifications, privacy, security, and account settings.' },
};

export default function StubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { title = 'Coming Soon' } = useLocalSearchParams<{ title: string }>();
  const config = STUB_CONFIG[decodeURIComponent(title)] ?? STUB_CONFIG['Feast 360'];
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={config.gradient} style={[styles.heroSection, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.heroContent}>
          <View style={styles.iconCircle}>
            <Ionicons name={config.icon as any} size={48} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>{decodeURIComponent(title)}</Text>
        </View>
      </LinearGradient>

      <View style={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            <Ionicons name="hammer" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.comingSoon, { color: colors.foreground }]}>Coming Soon</Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>{config.desc}</Text>
        </View>

        <View style={[styles.notifyBox, { backgroundColor: colors.muted }]}>
          <Ionicons name="notifications" size={24} color={colors.primary} />
          <Text style={[styles.notifyText, { color: colors.foreground }]}>We'll notify you when this feature launches in your area.</Text>
        </View>

        <TouchableOpacity
          style={[styles.homeBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(tabs)' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="home" size={18} color="#fff" />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroSection: { paddingHorizontal: 20, paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroContent: { alignItems: 'center', gap: 16 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#fff', textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 32, gap: 20 },
  card: { 
    borderRadius: 24, 
    padding: 32, 
    alignItems: 'center', 
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  comingSoon: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  desc: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  notifyBox: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20 },
  notifyText: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', lineHeight: 22 },
  homeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16, marginTop: 'auto' },
  homeBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
});