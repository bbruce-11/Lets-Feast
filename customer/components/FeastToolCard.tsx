import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  description: string;
  buttonText: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  onPress: () => void;
}

export default function FeastToolCard({ title, description, buttonText, icon, gradientColors, onPress }: Props) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.wrapper}>
      <LinearGradient colors={gradientColors} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.topSection}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={24} color="#fff" />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.desc} numberOfLines={2}>{description}</Text>
        <View style={styles.btn}>
          <Text style={styles.btnText}>{buttonText}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { 
    marginRight: 16, 
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  card: { 
    borderRadius: 24, 
    padding: 20, 
    minHeight: 180, 
    justifyContent: 'space-between' 
  },
  topSection: {
    gap: 12
  },
  iconCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.25)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  title: { 
    fontSize: 20, 
    fontFamily: 'Inter_700Bold', 
    color: '#fff' 
  },
  desc: { 
    fontSize: 13, 
    fontFamily: 'Inter_400Regular', 
    color: 'rgba(255,255,255,0.9)', 
    lineHeight: 18,
    marginTop: 4,
    flex: 1,
  },
  btn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#ffffff', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    alignSelf: 'flex-start',
    marginTop: 12
  },
  btnText: { 
    color: '#1F2933', 
    fontFamily: 'Inter_600SemiBold', 
    fontSize: 13 
  },
});
