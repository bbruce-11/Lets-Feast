import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { MenuItem } from '@/data/mockData';

interface Props {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export default function MenuItemCard({ item, quantity, onAdd, onRemove }: Props) {
  const colors = useColors();

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd();
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
        {item.dietaryTags.length > 0 && (
          <View style={styles.tags}>
            {item.dietaryTags.slice(0, 2).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.tagText, { color: '#166534' }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.price, { color: colors.foreground }]}>${item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.actionArea}>
        {quantity > 0 ? (
          <View style={[styles.quantityControl, { backgroundColor: colors.muted }]}>
            <TouchableOpacity onPress={handleRemove} style={styles.qtyBtn} activeOpacity={0.75}>
              <Ionicons name="remove" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.qty, { color: colors.foreground }]}>{quantity}</Text>
            <TouchableOpacity onPress={handleAdd} style={styles.qtyBtn} activeOpacity={0.75}>
              <Ionicons name="add" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleAdd} style={[styles.addBtn, { backgroundColor: colors.muted }]} activeOpacity={0.75}>
            <Ionicons name="add" size={20} color={colors.foreground} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  content: { flex: 1, paddingRight: 16 },
  name: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  desc: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 8 },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  price: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  actionArea: { justifyContent: 'flex-end', alignItems: 'flex-end' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: 15, fontFamily: 'Inter_600SemiBold', minWidth: 24, textAlign: 'center' },
});
