import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { geocodeAddress, type GeoResult } from '@/lib/geo';

interface Props {
  onSelect: (result: GeoResult) => void;
  placeholder?: string;
}

// Shared address search box used by both the web and native pin pickers. Debounces
// input, queries the geocoder, and shows a tappable dropdown of matches. Selecting
// a match clears the open dropdown and hands the coordinate back to the picker.
export function AddressSearch({ onSelect, placeholder = 'Search an address' }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const justSelected = useRef(false);

  useEffect(() => {
    const q = query.trim();
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    const handle = setTimeout(async () => {
      try {
        const matches = await geocodeAddress(q, { signal: controller.signal, limit: 5 });
        setResults(matches);
        setOpen(true);
        if (matches.length === 0) setError('No matches found.');
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setResults([]);
          setError('Could not search right now.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);

    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [query]);

  const handleSelect = (result: GeoResult) => {
    justSelected.current = true;
    setQuery(result.label);
    setResults([]);
    setOpen(false);
    setError('');
    onSelect(result);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setError('');
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={clear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.mutedForeground }]}>{error}</Text>
      ) : null}

      {open && results.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 200 }}>
            {results.map((r, i) => (
              <TouchableOpacity
                key={`${r.label}-${i}`}
                style={[
                  styles.resultRow,
                  i < results.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
                onPress={() => handleSelect(r)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={[styles.resultText, { color: colors.foreground }]} numberOfLines={2}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  error: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  resultRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  resultText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 19 },
});
