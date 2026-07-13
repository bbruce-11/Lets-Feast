import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ImageBackground, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { FeastWindow, Restaurant } from '@/data/mockData';
import CountdownTimer from './CountdownTimer';

const FOOD_IMAGES = [
  require('@/assets/images/food1.png'),
  require('@/assets/images/food2.png'),
  require('@/assets/images/food3.png'),
];

interface Props {
  restaurant: Restaurant;
  feastWindow?: FeastWindow;
  compact?: boolean;
}

export default function RestaurantCard({ restaurant, feastWindow, compact = false }: Props) {
  const colors = useColors();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  const hasFeastWindow = !!(feastWindow && feastWindow.endTime > Date.now());

  const spotsLeft = feastWindow ? feastWindow.spotsTotal - feastWindow.spotsFilled : 0;
  const isFull = spotsLeft <= 0;
  const showSpotsPill = hasFeastWindow && spotsLeft <= 3;

  return (
    <TouchableOpacity
      style={[
        styles.card, 
        { 
          backgroundColor: colors.card, 
          width: compact ? 220 : 280,
        }
      ]}
      onPress={() => router.push(`/restaurant/${restaurant.id}` as any)}
      activeOpacity={0.9}
    >
      <View style={styles.imageWrapper}>
        {!imgError ? (
          <ImageBackground
            source={FOOD_IMAGES[restaurant.imageIndex % 3]}
            style={styles.image}
            onError={() => setImgError(true)}
            imageStyle={styles.imageBg}
          >
            <View style={[styles.imageFallback, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />
            <View style={styles.imageBadges}>
              {restaurant.memberDeal && (
                <View style={[styles.memberBadge, { backgroundColor: colors.gold }]}>
                  <Text style={styles.memberText}>Member Deal</Text>
                </View>
              )}
            </View>
            <View style={styles.bottomBadges}>
              {hasFeastWindow && feastWindow && (
                <View style={[styles.windowBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="flash" size={12} color="#fff" />
                  <CountdownTimer endTime={feastWindow.endTime} compact style={{ color: '#fff', fontSize: 12 }} />
                </View>
              )}
              {showSpotsPill && (
                <View style={[styles.spotsBadge, { backgroundColor: colors.destructive }]}>
                  <Ionicons name={isFull ? 'lock-closed' : 'people'} size={12} color="#fff" />
                  <Text style={styles.spotsText}>
                    {isFull ? 'Full' : `${spotsLeft} left`}
                  </Text>
                </View>
              )}
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.image, { backgroundColor: colors.muted }]}>
            <Text style={[styles.fallbackText, { color: colors.mutedForeground }]}>{restaurant.name.charAt(0)}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{restaurant.name}</Text>
          <View style={styles.ratingBox}>
            <Text style={[styles.ratingText, { color: colors.foreground }]}>{restaurant.rating}</Text>
            <Ionicons name="star" size={10} color={colors.gold} />
          </View>
        </View>
        
        <Text style={[styles.cuisine, { color: colors.mutedForeground }]}>{restaurant.cuisine} · {restaurant.neighborhood}</Text>
        
        <View style={styles.row}>
          <View style={styles.metaItem}>
            <Ionicons name="bicycle" size={14} color={colors.mutedForeground} />
            <Text style={[styles.stat, { color: colors.mutedForeground }]}>{restaurant.deliveryTime}</Text>
          </View>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}>•</Text>
          <View style={styles.metaItem}>
            <Ionicons name="walk" size={14} color={colors.mutedForeground} />
            <Text style={[styles.stat, { color: colors.mutedForeground }]}>{restaurant.distance}</Text>
          </View>
        </View>
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
    marginBottom: 8, // room for shadow
  },
  imageWrapper: { width: '100%', height: 150, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  image: { width: '100%', height: '100%', justifyContent: 'space-between' },
  imageBg: { resizeMode: 'cover' },
  imageFallback: { ...StyleSheet.absoluteFillObject },
  imageBadges: { flexDirection: 'row', gap: 6, padding: 12 },
  memberBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  memberText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  bottomBadges: { flexDirection: 'row', gap: 6, padding: 12, justifyContent: 'flex-start' },
  windowBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  spotsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  spotsText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  fallbackText: { fontSize: 48, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 40 },
  info: { padding: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1, paddingRight: 8 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#F7F7F8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  ratingText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cuisine: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stat: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  dot: { fontSize: 10 },
});
