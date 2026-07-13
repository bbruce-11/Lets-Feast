import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { FeastWindow, Restaurant } from '@/data/mockData';
import RestaurantCard from './RestaurantCard';

interface Props {
  title: string;
  restaurants: Restaurant[];
  feastWindows?: Record<string, FeastWindow>;
  onSeeAll?: () => void;
}

export default function SectionCarousel({ title, restaurants, feastWindows, onSeeAll }: Props) {
  const colors = useColors();
  if (restaurants.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7} style={styles.seeAllBtn}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={restaurants}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RestaurantCard
            restaurant={item}
            feastWindow={item.feastWindowId && feastWindows ? feastWindows[item.feastWindowId] : undefined}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  seeAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  seeAll: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  list: { paddingLeft: 16, paddingRight: 4, paddingBottom: 8 },
});
