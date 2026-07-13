import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useOrders } from '@/hooks/useOrders';

const FINISHED_ORDER_STATUSES = new Set(['delivered', 'cancelled']);

const TOOLS = [
  { icon: 'beer-outline', label: 'One Drink', desc: 'Bars, clubs & member drink deals', route: '/stub?title=One+Drink', color: '#1A3A5C' },
  { icon: 'calendar-outline', label: 'Reserva', desc: 'Book tables & pre-order meals', route: '/stub?title=Reserva', color: '#2D5016' },
  { icon: 'people-outline', label: 'Catering', desc: 'Office, events & group orders', route: '/stub?title=Feast+Catering', color: '#5C1A5C' },
  { icon: 'leaf-outline', label: 'Grocery', desc: 'Local goods & essentials delivered', route: '/stub?title=Feast+Grocery', color: '#0D4F3C' },
  { icon: 'sparkles-outline', label: 'Feast 360', desc: 'Pop-up events & cultural dining', route: '/stub?title=Feast+360', color: '#3D1A5C' },
];

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orders } = useOrders();
  const activeOrderCount = orders.filter((o) => !FINISHED_ORDER_STATUSES.has(o.status)).length;
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>More to Feast</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 16 }}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => router.push('/order-history' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="receipt-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardLabel, { color: colors.foreground }]}>Orders</Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
              {activeOrderCount > 0
                ? `${activeOrderCount} active · track & view past orders`
                : 'Track active & view past orders'}
            </Text>
          </View>
          {activeOrderCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.countBadgeText, { color: colors.primaryForeground }]}>
                {activeOrderCount > 9 ? '9+' : String(activeOrderCount)}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        {TOOLS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color + '15' }]}>
              <Ionicons name={item.icon as any} size={24} color={item.color} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    padding: 16, 
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 4 },
  cardLabel: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  cardDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  countBadge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});
