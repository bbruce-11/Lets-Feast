import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import FeastToolCard from '@/components/FeastToolCard';
import SectionCarousel from '@/components/SectionCarousel';
import { feast360Events } from '@/data/mockData';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useFeastWindows } from '@/context/FeastWindowContext';

const TOOLS = [
  { title: 'Explore', description: 'Personalized restaurants based on your taste, allergies, location, and favorite cuisines.', buttonText: 'Start Exploring', icon: 'compass' as const, gradientColors: ['#89181A', '#5E1011'] as [string, string], route: '/explore' },
  { title: 'Delivery', description: 'Order now, pickup, or join a Feast Window when restaurants open delivery deals.', buttonText: 'Order Food', icon: 'bicycle' as const, gradientColors: ['#A57D2D', '#7A5C20'] as [string, string], route: '/delivery' },
  { title: 'One Drink', description: 'Find bars, restaurants, clubs, lounges, and member drink deals near you.', buttonText: 'Find Deals Near Me', icon: 'beer' as const, gradientColors: ['#334155', '#1E293B'] as [string, string], route: '/stub?title=One+Drink' },
  { title: 'Reserva', description: 'Book your table, choose your ride, and pre-order your meal before you arrive.', buttonText: 'Reserve a Table', icon: 'calendar' as const, gradientColors: ['#B91C1C', '#7F1D1D'] as [string, string], route: '/stub?title=Reserva' },
  { title: 'Feast Catering', description: 'Large food orders for offices, events, meetings, parties, and groups.', buttonText: 'Request Catering', icon: 'people' as const, gradientColors: ['#64748B', '#334155'] as [string, string], route: '/stub?title=Feast+Catering' },
  { title: 'Feast Grocery', description: 'Essentials, local goods, snacks, drinks, and groceries delivered.', buttonText: 'Shop Groceries', icon: 'cart' as const, gradientColors: ['#10B981', '#047857'] as [string, string], route: '/stub?title=Feast+Grocery' },
  { title: 'Feast 360', description: 'Pop-up food experiences, live DJs, local restaurants, and cultural dining events.', buttonText: 'View Events', icon: 'sparkles' as const, gradientColors: ['#8B5CF6', '#5B21B6'] as [string, string], route: '/stub?title=Feast+360' },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const { restaurants } = useRestaurants();
  const { feastWindows } = useFeastWindows();

  const fwMap = Object.fromEntries(feastWindows.map((fw) => [fw.id, fw]));
  const openRestaurants = restaurants.filter((r) => r.isOpen);
  const windowRestaurants = restaurants.filter((r) => r.feastWindowId);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View style={styles.topRow}>
          <View style={styles.logoRow}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logoMark} resizeMode="contain" />
            <Text style={[styles.logoText, { color: colors.foreground }]} numberOfLines={1}>Let's Feast</Text>
          </View>
          <View style={styles.locationRow}>
            <View style={[styles.locationIconWrap, { backgroundColor: colors.muted }]}>
               <Ionicons name="location" size={14} color={colors.foreground} />
            </View>
            <Text style={[styles.locationText, { color: colors.foreground }]}>Chicago, IL</Text>
            <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.8} style={styles.profileAvatar}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
               <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/search' as any)}
          style={[styles.searchBar, { backgroundColor: colors.muted }]}
        >
          <Ionicons name="search" size={20} color={colors.mutedForeground} />
          <Text style={[styles.searchText, { color: colors.mutedForeground }]}>Search food, drinks, events...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={[styles.greetingText, { color: colors.foreground }]}>What are you craving today?</Text>
          <Text style={[styles.moodText, { color: colors.mutedForeground }]}>Order food, discover places, and unlock local experiences.</Text>
        </View>

        {/* Main Feast Tools Carousel */}
        <FlatList
          data={TOOLS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.title}
          contentContainerStyle={styles.toolsCarousel}
          renderItem={({ item }) => (
            <FeastToolCard
              title={item.title}
              description={item.description}
              buttonText={item.buttonText}
              icon={item.icon}
              gradientColors={item.gradientColors}
              onPress={() => router.push(item.route as any)}
            />
          )}
        />

        {/* Sections */}
        <SectionCarousel title="Recommended For You" restaurants={openRestaurants.slice(0, 6)} feastWindows={fwMap} onSeeAll={() => router.push('/explore' as any)} />
        <SectionCarousel title="Feast Windows Open Now" restaurants={windowRestaurants} feastWindows={fwMap} onSeeAll={() => router.push('/delivery' as any)} />
        <SectionCarousel title="Popular Near You" restaurants={openRestaurants.slice(2, 8)} feastWindows={fwMap} onSeeAll={() => router.push('/explore' as any)} />
        <SectionCarousel title="Pickup Nearby" restaurants={openRestaurants.slice(1, 6)} feastWindows={fwMap} />
        <SectionCarousel title="Tonight on One Drink" restaurants={openRestaurants.slice(0, 3)} />

        {/* Feast 360 Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming Feast 360 Events</Text>
            <TouchableOpacity onPress={() => router.push('/stub?title=Feast+360' as any)} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {feast360Events.map((event) => (
            <TouchableOpacity key={event.id} style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.85}>
              <View style={[styles.eventImagePlaceholder, { backgroundColor: colors.muted }]}>
                <Ionicons name="musical-notes" size={32} color={colors.primary} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventName, { color: colors.foreground }]} numberOfLines={1}>{event.name}</Text>
                <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>{event.date}</Text>
                <Text style={[styles.eventVenue, { color: colors.mutedForeground }]}>{event.venue} · {event.neighborhood}</Text>
                <View style={[styles.eventPriceBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.eventPrice, { color: colors.foreground }]}>From ${event.price}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <SectionCarousel title="Reorder Favorites" restaurants={openRestaurants.slice(3, 8)} feastWindows={fwMap} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  logoMark: { width: 28, height: 26 },
  logoText: { fontSize: 20, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginHorizontal: 12 },
  locationIconWrap: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  locationText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  profileAvatar: {},
  avatarCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  searchText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  greeting: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  greetingText: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  moodText: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  toolsCarousel: { paddingLeft: 20, paddingRight: 4, paddingVertical: 24 },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  seeAll: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  eventCard: { 
    marginHorizontal: 20, 
    marginBottom: 12, 
    borderRadius: 20, 
    flexDirection: 'row', 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventImagePlaceholder: { width: 100, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1, padding: 16, gap: 4 },
  eventName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  eventDate: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  eventVenue: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  eventPriceBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  eventPrice: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});