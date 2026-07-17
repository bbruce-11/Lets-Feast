import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { searchAddress, type GeocodeResult } from '@/lib/geocoding';

interface Props {
  value: string;
  onSelect: (result: GeocodeResult) => void;
}

const DEBOUNCE_MS = 500;

export function AddressPicker({ value, onSelect }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSelected, setHasSelected] = useState(!!value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hasSelected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchAddress(query);
        setResults(found);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, hasSelected]);

  function handleChangeText(text: string) {
    setQuery(text);
    setHasSelected(false);
  }

  function handleSelect(result: GeocodeResult) {
    setQuery(result.displayName);
    setResults([]);
    setHasSelected(true);
    onSelect(result);
  }

  return (
    <View>
      <View style={[styles.inputWrapper, { backgroundColor: colors.input }]}>
        <TextInput
          value={query}
          onChangeText={handleChangeText}
          placeholder="Search for your address"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
        />
        {isSearching && <ActivityIndicator size="small" color={colors.mutedForeground} />}
      </View>

      {results.length > 0 && (
        <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {results.map((result, i) => (
            <TouchableOpacity
              key={`${result.lat}-${result.lng}-${i}`}
              onPress={() => handleSelect(result)}
              style={[
                styles.suggestionRow,
                i < results.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Ionicons name="location-outline" size={16} color={colors.mutedForeground} />
              <Text style={{ color: colors.foreground, flex: 1 }} numberOfLines={2}>
                {result.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, height: '100%' },
  suggestions: { borderRadius: 12, borderWidth: 1, marginTop: 6, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
});
