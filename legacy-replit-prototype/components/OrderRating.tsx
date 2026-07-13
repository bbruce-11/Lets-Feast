import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { ordersApi, type ApiOrder } from '@/lib/api';

const STAR_COLOR = '#F59E0B';

/** Compact, read-only row of stars for list previews. */
export function RatingStars({ rating, size = 16 }: { rating: number; size?: number }) {
  const colors = useColors();
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={size}
          color={n <= rating ? STAR_COLOR : colors.mutedForeground}
        />
      ))}
    </View>
  );
}

/**
 * Full rating card used on the order detail screen. Shows the submitted rating
 * (read-only) when the order has already been rated, otherwise lets the user
 * submit one via the shared POST /orders/:id/rating endpoint. Mirrors the
 * confirmation screen's rating UI for consistency.
 */
export function RatingCard({
  order,
  onRated,
}: {
  order: ApiOrder;
  onRated?: (updated: ApiOrder) => void;
}) {
  const colors = useColors();
  const alreadyRated = order.rating != null;
  const [selectedRating, setSelectedRating] = useState(order.rating ?? 0);
  const [comment, setComment] = useState(order.ratingComment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(alreadyRated);

  if (done) {
    const shownRating = order.rating ?? selectedRating;
    const shownComment = order.ratingComment ?? (comment.trim() || '');
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.thanks}>
          <View style={[styles.thanksIcon, { backgroundColor: '#22C55E15' }]}>
            <Ionicons name="heart" size={24} color="#22C55E" />
          </View>
          <Text style={[styles.thanksTitle, { color: colors.foreground }]}>Your rating</Text>
          <RatingStars rating={shownRating} size={24} />
          {shownComment ? (
            <Text style={[styles.thanksSub, { color: colors.mutedForeground }]}>
              “{shownComment}”
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => {
              setSelectedRating(order.rating ?? selectedRating);
              setComment(order.ratingComment ?? comment);
              setError('');
              setDone(false);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.editText, { color: colors.primary }]}>Edit rating</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>How was your feast?</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Rate this order to help the restaurant.
      </Text>
      <View style={styles.starsInputRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => {
              setSelectedRating(n);
              setError('');
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons
              name={n <= selectedRating ? 'star' : 'star-outline'}
              size={36}
              color={n <= selectedRating ? STAR_COLOR : colors.mutedForeground}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[
          styles.input,
          { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
        ]}
        placeholder="Add a comment (optional)"
        placeholderTextColor={colors.mutedForeground}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={500}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[
          styles.submit,
          { backgroundColor: selectedRating > 0 ? colors.primary : colors.mutedForeground },
        ]}
        disabled={selectedRating === 0 || submitting}
        onPress={async () => {
          if (selectedRating === 0) return;
          setSubmitting(true);
          setError('');
          try {
            const updated = await ordersApi.rate(
              order.id,
              selectedRating,
              comment.trim() || undefined,
            );
            setDone(true);
            onRated?.(updated);
          } catch (e: any) {
            setError(e?.message ?? 'Could not submit rating. Try again.');
          } finally {
            setSubmitting(false);
          }
        }}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitText}>{alreadyRated ? 'Update Rating' : 'Submit Rating'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  starsRow: { flexDirection: 'row', gap: 4 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20 },
  starsInputRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  input: {
    width: '100%',
    height: 100,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  errorText: { color: '#89181A', fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 16 },
  submit: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  thanks: { alignItems: 'center', gap: 12 },
  thanksIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  thanksTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  thanksSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', fontStyle: 'italic', marginTop: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 4 },
  editText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
