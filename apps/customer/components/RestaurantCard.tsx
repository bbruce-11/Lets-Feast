import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { ApiRestaurant } from '@/lib/api';

const FOOD_IMAGES = [
  require('@/assets/images/food1.png'),
  require('@/assets/images/food2.png'),
  require('@/assets/images/food3.png'),
];

// Restaurants don't have an image field yet, so pick a stable image per
// restaurant from its id, rather than a random one that changes on every
// re-render.
function imageForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FOOD_IMAGES[hash % FOOD_IMAGES.length];
}

export function RestaurantCard({
  restaurant,
  compact = false,
}: {
  restaurant: ApiRestaurant;
  compact?: boolean;
}) {
  const colors = useColors();
  const rating = restaurant.rating != null ? Number.parseFloat(restaurant.rating) : null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, width: compact ? 220 : 280 }]}
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
      activeOpacity={0.9}
    >
      <View style={styles.imageWrapper}>
        <ImageBackground source={imageForId(restaurant.id)} style={styles.image} imageStyle={styles.imageBg}>
          {!restaurant.isOpen && (
            <View style={styles.imageBadges}>
              <View style={[styles.closedBadge, { backgroundColor: colors.foreground }]}>
                <Text style={styles.closedText}>Closed</Text>
              </View>
            </View>
          )}
        </ImageBackground>
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {rating != null && (
            <View style={[styles.ratingBox, { backgroundColor: colors.muted }]}>
              <Text style={[styles.ratingText, { color: colors.foreground }]}>{rating.toFixed(1)}</Text>
              <Ionicons name="star" size={10} color={colors.accent} />
            </View>
          )}
        </View>
        <Text style={[styles.cuisine, { color: colors.mutedForeground }]} numberOfLines={1}>
          {restaurant.cuisine} · {restaurant.neighborhood}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 8,
  },
  imageWrapper: { width: '100%', height: 150, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  image: { width: '100%', height: '100%', justifyContent: 'flex-start' },
  imageBg: { resizeMode: 'cover' },
  imageBadges: { flexDirection: 'row', gap: 6, padding: 12 },
  closedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  closedText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  info: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1, paddingRight: 8 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  ratingText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cuisine: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
