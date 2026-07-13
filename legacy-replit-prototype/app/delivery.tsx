import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import FilterChips from '@/components/FilterChips';
import RestaurantCard from '@/components/RestaurantCard';
import SectionCarousel from '@/components/SectionCarousel';
import SpotsPill from '@/components/SpotsPill';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useFeastWindows } from '@/context/FeastWindowContext';

const FILTERS = ['Delivery', 'Pickup', 'Feast Window', 'Open Now', 'Fastest', 'Deals'];

export default function DeliveryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filters, setFilters] = useState<string[]>(['Delivery']);
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const { restaurants } = useRestaurants();
  const { feastWindows } = useFeastWindows();

  const fwMap = Object.fromEntries(feastWindows.map((fw) => [fw.id, fw]));

  const toggleFilter = (f: string) => {
    setFilters((p) => p.includes(f) ? p.filter((x) => x !== f) : [...p, f]);
  };

  const openRestaurants = restaurants.filter((r) => r.isOpen);
  const windowRestaurants = restaurants.filter((r) => r.feastWindowId && fwMap[r.feastWindowId!]?.endTime > Date.now());
  const fastestRestaurants = [...restaurants].sort((a, b) => parseInt(a.deliveryTime) - parseInt(b.deliveryTime)).slice(0, 6);
  const pickupRestaurants = [...restaurants].sort((a, b) => parseInt(a.pickupTime) - parseInt(b.pickupTime));
  const popularRestaurants = [...restaurants].sort((a, b) => b.rating - a.rating).slice(0, 6);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Image source={require('@/assets/images/logo.png')} style={styles.logoMark} resizeMode="contain" />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>Delivery</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Food to your door, fast.</Text>
        </View>
      </View>

      <FilterChips options={FILTERS} selected={filters} onToggle={toggleFilter} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}>
        {/* Feast Windows - highlighted section */}
        {windowRestaurants.length > 0 && (
          <View style={styles.windowSection}>
            <View style={styles.windowHeader}>
              <View style={[styles.windowBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="flash" size={14} color="#fff" />
                <Text style={styles.windowBadgeText}>Feast Windows Open</Text>
              </View>
              <Text style={[styles.windowSubtitle, { color: colors.mutedForeground }]}>Save on group delivery deals right now</Text>
            </View>
            <FlatList
              data={windowRestaurants}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 4, paddingBottom: 8 }}
              renderItem={({ item }) => (
                <RestaurantCard
                  restaurant={item}
                  feastWindow={item.feastWindowId ? fwMap[item.feastWindowId] : undefined}
                />
              )}
            />
          </View>
        )}

        <SectionCarousel title="Open Now" restaurants={openRestaurants} feastWindows={fwMap} />
        <SectionCarousel title="Fastest Delivery" restaurants={fastestRestaurants} feastWindows={fwMap} />
        <SectionCarousel title="Pickup Available" restaurants={pickupRestaurants.slice(0, 5)} feastWindows={fwMap} />
        <SectionCarousel title="Popular Near You" restaurants={popularRestaurants} feastWindows={fwMap} />

        {/* All Restaurants */}
        <View style={styles.allSection}>
          <Text style={[styles.allTitle, { color: colors.foreground }]}>All Restaurants</Text>
          {restaurants.map((r) => {
            const fw = r.feastWindowId ? fwMap[r.feastWindowId] : undefined;
            const hasFeastWindow = !!(fw && fw.endTime > Date.now());
            const spotsLeft = fw ? fw.spotsTotal - fw.spotsFilled : 0;
            const showSpotsPill = hasFeastWindow && spotsLeft <= 3;
            return (
            <TouchableOpacity
              key={r.id}
              style={[styles.listItem, { backgroundColor: colors.card }]}
              onPress={() => router.push(`/restaurant/${r.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.listIcon, { backgroundColor: r.bgColor }]}>
                <Text style={styles.listInitial}>{r.name.charAt(0)}</Text>
              </View>
              <View style={styles.listInfo}>
                <View style={styles.listTop}>
                  <Text style={[styles.listName, { color: colors.foreground }]} numberOfLines={1}>{r.name}</Text>
                  {hasFeastWindow && (
                    <View style={[styles.listWindowBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="flash" size={12} color="#fff" />
                    </View>
                  )}
                  {showSpotsPill && <SpotsPill spotsLeft={spotsLeft} size="sm" />}
                </View>
                <Text style={[styles.listSub, { color: colors.mutedForeground }]}>{r.cuisine} · {r.neighborhood}</Text>
                <View style={styles.listMeta}>
                  <View style={styles.ratingBox}>
                    <Text style={[styles.listMetaText, { color: colors.foreground }]}>{r.rating}</Text>
                    <Ionicons name="star" size={10} color={colors.gold} />
                  </View>
                  <Text style={[styles.listDot, { color: colors.mutedForeground }]}>·</Text>
                  <Text style={[styles.listMetaText, { color: colors.mutedForeground }]}>{r.deliveryTime}</Text>
                  <Text style={[styles.listDot, { color: colors.mutedForeground }]}>·</Text>
                  <Text style={[styles.listMetaText, { color: colors.mutedForeground }]}>{r.distance}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  logoMark: { width: 30, height: 28 },
  headerText: { flex: 1 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 4 },
  windowSection: { marginBottom: 32 },
  windowHeader: { paddingHorizontal: 20, marginBottom: 16, gap: 6 },
  windowBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  windowBadgeText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  windowSubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  allSection: { paddingHorizontal: 20, marginTop: 8 },
  allTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  listItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  listInitial: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
  listInfo: { flex: 1, gap: 4 },
  listTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', flex: 1 },
  listWindowBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listSub: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F7F8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  listMetaText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  listDot: { fontSize: 13 },
});
