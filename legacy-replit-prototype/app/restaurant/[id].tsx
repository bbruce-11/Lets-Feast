import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useCart } from '@/context/CartContext';
import { useRestaurant } from '@/hooks/useRestaurants';
import { useFeastWindows } from '@/context/FeastWindowContext';
import { useMenuItems } from '@/hooks/useMenuItems';
import { useReviews } from '@/hooks/useReviews';
import FeastWindowBanner from '@/components/FeastWindowBanner';
import MenuItemCard from '@/components/MenuItemCard';

// Compact relative date for review timestamps, e.g. "Today", "3 days ago",
// "2 weeks ago". Falls back to an empty string for legacy reviews missing a date.
function relativeDate(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export default function RestaurantScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, join } = useLocalSearchParams<{ id: string; join?: string }>();
  const pendingJoin = Array.isArray(join) ? join[0] : join;
  const resumedJoinRef = useRef<string | null>(null);
  const { user } = useApp();
  const { addItem, updateQuantity, items, joinFeastWindow } = useCart();
  const [activeCategory, setActiveCategory] = useState('Popular');

  const { restaurant } = useRestaurant(id ?? '');
  const { menuItems: allItems } = useMenuItems(id ?? '');
  const { reviews, isLoading: reviewsLoading } = useReviews(id ?? '');
  const { feastWindows, joinedWindowIds } = useFeastWindows();

  const fwMap = Object.fromEntries(feastWindows.map((fw) => [fw.id, fw]));
  const feastWindow = restaurant?.feastWindowId ? fwMap[restaurant.feastWindowId] : undefined;
  const isFeastWindowActive = feastWindow && feastWindow.endTime > Date.now();
  const alreadyJoined = feastWindow ? joinedWindowIds.includes(feastWindow.id) : false;

  const categories = restaurant?.categories ?? [];
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  if (!restaurant) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Restaurant not found</Text>
      </View>
    );
  }

  const filteredItems = activeCategory === 'Popular'
    ? allItems.slice(0, 5)
    : allItems.filter((item) => item.category === activeCategory);

  const getQty = (itemId: string) => items.find((i) => i.menuItem.id === itemId)?.quantity ?? 0;

  const [joinError, setJoinError] = useState('');

  const goToSignIn = () => {
    router.push({
      pathname: '/signin',
      params: feastWindow
        ? { redirect: `/restaurant/${id}`, join: feastWindow.id }
        : { redirect: `/restaurant/${id}` },
    } as any);
  };

  const handleJoinWindow = async () => {
    if (!feastWindow) return;
    setJoinError('');
    if (!user) {
      if (Platform.OS === 'web') {
        goToSignIn();
      } else {
        Alert.alert(
          'Sign in to join',
          'Create an account or sign in to lock in this Feast Window deal. Your cart will be waiting.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Sign In', onPress: goToSignIn },
          ],
        );
      }
      return;
    }
    try {
      await joinFeastWindow(feastWindow.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setJoinError(err?.message ?? 'Could not join Feast Window. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Resume the join the guest intended before being routed to sign in. Signin
  // sends them back here with a `join` param; complete it once, then clear the
  // param so it can't re-fire.
  useEffect(() => {
    if (!pendingJoin || !user || !feastWindow) return;
    if (pendingJoin !== feastWindow.id) return;
    if (resumedJoinRef.current === pendingJoin) return;
    resumedJoinRef.current = pendingJoin;
    router.setParams({ join: undefined } as any);
    if (!alreadyJoined && isFeastWindowActive) {
      handleJoinWindow();
    }
  }, [pendingJoin, user, feastWindow?.id]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Cover Header */}
      <View style={[styles.coverHeader, { backgroundColor: restaurant.bgColor, height: 160 + topPad }]}>
        <View style={[styles.coverOverlay, { paddingTop: topPad + 8, paddingHorizontal: 20 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.coverBottom}>
          <View style={[styles.restaurantLogo, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.logoText}>{restaurant.name.charAt(0)}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Restaurant Info */}
        <View style={[styles.infoSection, { backgroundColor: colors.background }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.restaurantName, { color: colors.foreground }]}>{restaurant.name}</Text>
            <View style={styles.ratingBox}>
              <Text style={[styles.metaText, { color: colors.foreground }]}>{restaurant.rating}</Text>
              <Ionicons name="star" size={12} color={colors.gold} />
            </View>
          </View>
          <Text style={[styles.cuisine, { color: colors.mutedForeground }]}>{restaurant.cuisine} · {restaurant.neighborhood}</Text>
          
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>({restaurant.numRatings.toLocaleString()} ratings)</Text>
            <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
            <Ionicons name="location" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{restaurant.distance}</Text>
          </View>
          
          <View style={styles.timeRow}>
            <View style={[styles.timeBadge, { backgroundColor: colors.muted }]}>
              <Ionicons name="bicycle" size={16} color={colors.foreground} />
              <Text style={[styles.timeText, { color: colors.foreground }]}>{restaurant.deliveryTime}</Text>
            </View>
            <View style={[styles.timeBadge, { backgroundColor: colors.muted }]}>
              <Ionicons name="walk" size={16} color={colors.foreground} />
              <Text style={[styles.timeText, { color: colors.foreground }]}>Pickup {restaurant.pickupTime}</Text>
            </View>
            {restaurant.isOpen && (
               <View style={[styles.timeBadge, { backgroundColor: '#DCFCE7' }]}>
                 <Text style={[styles.timeText, { color: '#166534' }]}>Open</Text>
               </View>
            )}
          </View>
          
          {restaurant.allergyTags.length > 0 && (
            <View style={styles.tags}>
              {restaurant.allergyTags.slice(0, 3).map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.tagText, { color: '#92400E' }]}>{tag}-free</Text>
                </View>
              ))}
              {restaurant.dietaryTags.slice(0, 2).map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.tagText, { color: '#166534' }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Feast Window Banner */}
        {isFeastWindowActive && feastWindow && (
          <View style={[styles.bannerSection, { backgroundColor: colors.background }]}>
            <FeastWindowBanner feastWindow={feastWindow} onJoin={handleJoinWindow} alreadyJoined={alreadyJoined} />
            {joinError ? (
              <Text style={[styles.joinErrorText, { color: colors.destructive }]}>{joinError}</Text>
            ) : null}
          </View>
        )}

        {/* Category Tabs - sticky */}
        <View style={[styles.categoryTabs, { backgroundColor: colors.background }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catTab, activeCategory === cat && { backgroundColor: colors.foreground }]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.catTabText, { color: activeCategory === cat ? '#fff' : colors.foreground, fontFamily: activeCategory === cat ? 'Inter_600SemiBold' : 'Inter_500Medium' }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={[styles.categoryTitle, { color: colors.foreground }]}>{activeCategory}</Text>
          {filteredItems.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No items in this category</Text>
          ) : (
            filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                quantity={getQty(item.id)}
                onAdd={() => addItem(restaurant, item)}
                onRemove={() => updateQuantity(item.id, getQty(item.id) - 1)}
              />
            ))
          )}
        </View>

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <Text style={[styles.categoryTitle, { color: colors.foreground }]}>Reviews</Text>
          {reviewsLoading ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading reviews…</Text>
          ) : reviews.length === 0 ? (
            <View style={styles.reviewsEmpty}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.reviewsEmptyText, { color: colors.mutedForeground }]}>
                No written reviews yet. Be the first to share your experience after your order arrives.
              </Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { borderBottomColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewName, { color: colors.foreground }]}>{review.reviewerName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= review.rating ? 'star' : 'star-outline'}
                        size={13}
                        color={colors.gold}
                      />
                    ))}
                  </View>
                </View>
                {relativeDate(review.ratedAt) ? (
                  <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>{relativeDate(review.ratedAt)}</Text>
                ) : null}
                <Text style={[styles.reviewComment, { color: colors.foreground }]}>{review.comment}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Cart Footer */}
      {items.length > 0 && (
        <View style={[styles.cartFooter, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <TouchableOpacity style={[styles.cartBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(tabs)/cart' as any)} activeOpacity={0.85}>
            <View style={styles.cartBtnInner}>
              <View style={[styles.cartCount, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.cartCountText}>{items.reduce((s, i) => s + i.quantity, 0)}</Text>
              </View>
              <Text style={styles.cartBtnText}>View Cart</Text>
            </View>
            <Text style={styles.cartBtnPrice}>${items.reduce((s, i) => s + i.menuItem.price * i.quantity, 0).toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  coverHeader: { position: 'relative', justifyContent: 'space-between' },
  coverOverlay: {},
  coverBottom: { paddingHorizontal: 20, paddingBottom: 0 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  restaurantLogo: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: 36 }] },
  logoText: { color: '#fff', fontSize: 32, fontFamily: 'Inter_700Bold' },
  infoSection: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  restaurantName: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 4, flex: 1 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F7F8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  cuisine: { fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  metaText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  metaDot: { fontSize: 14 },
  timeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  timeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  bannerSection: { paddingHorizontal: 20, paddingBottom: 16 },
  joinErrorText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 8 },
  categoryTabs: { borderBottomWidth: StyleSheet.hairlineWidth },
  categoryScroll: { paddingHorizontal: 20, gap: 8, paddingVertical: 12 },
  catTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  catTabText: { fontSize: 15 },
  menuSection: { paddingHorizontal: 20, paddingTop: 24 },
  categoryTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 32 },
  reviewsSection: { paddingHorizontal: 20, paddingTop: 32 },
  reviewsEmpty: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  reviewsEmptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  reviewCard: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reviewName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  reviewComment: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: 8 },
  cartFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  cartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16 },
  cartBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartCount: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cartCountText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  cartBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17 },
  cartBtnPrice: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 17 },
});
