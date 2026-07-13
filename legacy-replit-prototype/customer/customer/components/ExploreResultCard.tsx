import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { type FeastWindow } from '@/data/mockData';
import { type RankedRestaurant } from '@/lib/exploreRecommend';

const FOOD_IMAGES = [
  require('@/assets/images/food1.png'),
  require('@/assets/images/food2.png'),
  require('@/assets/images/food3.png'),
];

interface Props {
  ranked: RankedRestaurant;
  feastWindow?: FeastWindow;
}

export default function ExploreResultCard({ ranked, feastWindow }: Props) {
  const colors = useColors();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const { restaurant: r, rank, reason, matchedTags, price, closesAt, waitLabel } = ranked;

  const hasFeastWindow = !!(feastWindow && feastWindow.endTime > Date.now());
  const spotsLeft = feastWindow ? feastWindow.spotsTotal - feastWindow.spotsFilled : 0;
  const isFull = spotsLeft <= 0;
  const showSpotsPill = hasFeastWindow && spotsLeft <= 3;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      activeOpacity={0.92}
      onPress={() => router.push(`/restaurant/${r.id}` as any)}
    >
      <View style={styles.imageWrapper}>
        {!imgError ? (
          <ImageBackground
            source={FOOD_IMAGES[r.imageIndex % 3]}
            style={styles.image}
            imageStyle={styles.imageBg}
            onError={() => setImgError(true)}
          >
            <View style={[styles.imageTint, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />
          </ImageBackground>
        ) : (
          <View style={[styles.image, { backgroundColor: colors.muted }]} />
        )}
        <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: r.isOpen ? '#22C55E' : colors.mutedForeground },
          ]}
        >
          <Text style={styles.statusText}>{r.isOpen ? 'Open' : 'Closed'}</Text>
        </View>
        {showSpotsPill && (
          <View style={[styles.spotsBadge, { backgroundColor: colors.destructive }]}>
            <Ionicons name={isFull ? 'lock-closed' : 'people'} size={12} color="#fff" />
            <Text style={styles.spotsText}>{isFull ? 'Full' : `${spotsLeft} left`}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[styles.price, { color: colors.foreground }]}>{price}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.ratingBox}>
            <Text style={[styles.metaStrong, { color: colors.foreground }]}>{r.rating}</Text>
            <Ionicons name="star" size={10} color={colors.gold} />
          </View>
          <Text style={[styles.metaMuted, { color: colors.mutedForeground }]}>
            ({r.numRatings.toLocaleString()})
          </Text>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.metaMuted, { color: colors.mutedForeground }]}>{r.distance}</Text>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.metaMuted, { color: colors.mutedForeground }]} numberOfLines={1}>
            {r.cuisine}
          </Text>
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Ionicons name="bicycle-outline" size={15} color={colors.mutedForeground} />
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
              {r.deliveryTime} delivery
            </Text>
          </View>
          <View style={styles.timeItem}>
            <Ionicons name="bag-handle-outline" size={15} color={colors.mutedForeground} />
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
              {r.pickupTime} pickup
            </Text>
          </View>
        </View>

        {matchedTags.length > 0 && (
          <View style={styles.tags}>
            {matchedTags.map((tag) => (
              <View key={tag} style={[styles.matchTag, { backgroundColor: colors.muted }]}>
                <Ionicons name="checkmark" size={12} color={colors.primary} />
                <Text style={[styles.matchTagText, { color: colors.foreground }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.reasonBox, { backgroundColor: colors.muted }]}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text style={[styles.reasonText, { color: colors.foreground }]}>{reason}</Text>
        </View>

        <TouchableOpacity
          style={[styles.viewBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => router.push(`/restaurant/${r.id}` as any)}
        >
          <Text style={styles.viewBtnText}>View Menu</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { 
    borderRadius: 24, 
    overflow: 'hidden', 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  imageWrapper: { width: '100%', height: 180, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageBg: { resizeMode: 'cover' },
  imageTint: { ...StyleSheet.absoluteFillObject },
  rankBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  rankText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  spotsBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  spotsText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { fontSize: 20, fontFamily: 'Inter_700Bold', flex: 1 },
  price: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F7F8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  metaStrong: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  metaMuted: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  dot: { fontSize: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  matchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  matchTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  reasonText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 20 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 20,
  },
  viewBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
