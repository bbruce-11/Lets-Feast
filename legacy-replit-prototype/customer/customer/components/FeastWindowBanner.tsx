import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { FeastWindow } from '@/data/mockData';
import CountdownTimer from './CountdownTimer';

interface Props {
  feastWindow: FeastWindow;
  onJoin: () => void;
  onContinue?: () => void;
  compact?: boolean;
  alreadyJoined?: boolean;
}

export default function FeastWindowBanner({ feastWindow, onJoin, onContinue, compact = false, alreadyJoined = false }: Props) {
  const colors = useColors();
  const [expired, setExpired] = useState(feastWindow.endTime <= Date.now());
  const spotsLeft = feastWindow.spotsTotal - feastWindow.spotsFilled;
  const isFull = spotsLeft <= 0;

  if (expired) {
    return (
      <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[styles.expiredText, { color: colors.mutedForeground }]}>
          This Feast Deal expired. Choose the next Feast Window or continue with regular delivery.
        </Text>
      </View>
    );
  }

  if (isFull) {
    return (
      <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: colors.mutedForeground }]}>
            <Ionicons name="people" size={14} color="#fff" />
            <Text style={styles.badgeText}>Feast Window Full</Text>
          </View>
        </View>
        {!compact && (
          <>
            <Text style={[styles.info, { color: colors.mutedForeground }]}>
              Delivery {feastWindow.deliveryStart} – {feastWindow.deliveryEnd}
            </Text>
            <View style={styles.spotsRow}>
              <View style={[styles.spotsBar, { backgroundColor: colors.border }]}>
                <View style={[styles.spotsProgress, { backgroundColor: colors.mutedForeground, width: '100%' }]} />
              </View>
              <Text style={[styles.spotsText, { color: colors.mutedForeground }]}>
                {feastWindow.spotsTotal}/{feastWindow.spotsTotal} spots filled • Full
              </Text>
            </View>
            <View style={[styles.joinBtn, styles.joinBtnDisabled]}>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.joinBtnText}>This Window is Full</Text>
            </View>
            {onContinue && (
              <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.7}>
                <Text style={[styles.continueBtnText, { color: colors.mutedForeground }]}>Continue with Regular Delivery</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#FFFDF5', borderColor: colors.gold }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: alreadyJoined ? colors.success : colors.gold }]}>
          <Ionicons name={alreadyJoined ? 'checkmark-circle' : 'flash'} size={14} color="#fff" />
          <Text style={styles.badgeText}>{alreadyJoined ? "You're in!" : 'Feast Window Open'}</Text>
        </View>
        <View style={styles.timerRow}>
          <Text style={[styles.orderIn, { color: colors.foreground }]}>Order in </Text>
          <CountdownTimer endTime={feastWindow.endTime} onExpire={() => setExpired(true)} compact />
        </View>
      </View>
      {!compact && (
        <>
          <View style={styles.savingsRow}>
             <Text style={[styles.info, { color: colors.foreground }]}>
               Delivery {feastWindow.deliveryStart} – {feastWindow.deliveryEnd}
             </Text>
             <Text style={[styles.savingsText, { color: colors.primary }]}>Save ${feastWindow.discount.toFixed(2)}</Text>
          </View>
          <View style={styles.spotsRow}>
            <View style={[styles.spotsBar, { backgroundColor: colors.border }]}>
              <View style={[styles.spotsProgress, { backgroundColor: colors.gold, width: `${(feastWindow.spotsFilled / feastWindow.spotsTotal) * 100}%` as any }]} />
            </View>
            <Text style={[styles.spotsText, { color: spotsLeft <= 3 ? colors.destructive : colors.mutedForeground }]}>
              {feastWindow.spotsFilled}/{feastWindow.spotsTotal} spots filled • {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
            </Text>
          </View>
          {alreadyJoined ? (
            <View style={[styles.joinedRow, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.joinedText, { color: colors.success }]}>You're in this Feast Window</Text>
            </View>
          ) : (
            <TouchableOpacity style={[styles.joinBtn, { backgroundColor: colors.primary }]} onPress={onJoin} activeOpacity={0.85}>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.joinBtnText}>Join Window & Save ${feastWindow.discount.toFixed(2)}</Text>
            </TouchableOpacity>
          )}
          {onContinue && (
            <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.7}>
              <Text style={[styles.continueBtnText, { color: colors.mutedForeground }]}>Continue with Regular Delivery</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  timerRow: { flexDirection: 'row', alignItems: 'center' },
  orderIn: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  savingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  savingsText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  info: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  spotsRow: { marginBottom: 16 },
  spotsBar: { height: 6, borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  spotsProgress: { height: '100%', borderRadius: 3 },
  spotsText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  joinBtnDisabled: { backgroundColor: '#9CA3AF' },
  joinedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  joinedText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  joinBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },
  continueBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  continueBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  expiredText: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
});
