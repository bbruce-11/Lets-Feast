import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import ScreenHeader from '@/components/ScreenHeader';

interface Topic {
  q: string;
  a: string;
}

const TOPICS: Topic[] = [
  { q: 'Where is my order?', a: 'Open the order from Order History and tap Track Order to see live status and your driver\'s progress.' },
  { q: 'I have a missing item', a: 'Let us know which item was missing using the form below and we\'ll arrange a refund or redelivery.' },
  { q: 'I need a refund', a: 'Refunds for eligible orders are processed within 3–5 business days. Submit a request below with your order number.' },
  { q: 'My Feast Window deal expired', a: 'Feast Window deals are time-limited. If your deal expired before checkout, contact us and we\'ll do our best to honor it.' },
  { q: 'Contact restaurant', a: 'During an active order you can message the restaurant directly from the order tracking screen.' },
  { q: 'Contact Feast support', a: 'Our support team is available 7am–11pm daily. Use the form below and we\'ll follow up by email.' },
];

const ISSUE_TYPES = ['Order issue', 'Payment', 'Account', 'Feast Rewards', 'Other'];

export default function HelpSupportScreen() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<string>('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter((t) => t.q.toLowerCase().includes(q) || t.a.toLowerCase().includes(q));
  }, [search]);

  const handleSubmit = () => {
    if (!issueType) return setError('Please choose an issue type.');
    if (message.trim().length < 5) return setError('Please describe your issue.');
    setError('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    setMessage('');
    setIssueType('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Help & Support" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: colors.input }]}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search help topics"
              placeholderTextColor={colors.mutedForeground}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Topics */}
          <View style={styles.sectionGroup}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Common topics</Text>
            {filteredTopics.length === 0 ? (
              <Text style={[styles.noResults, { color: colors.mutedForeground }]}>
                No topics match "{search}". Try the support form below.
              </Text>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                {filteredTopics.map((topic, idx) => {
                  const open = expanded === topic.q;
                  return (
                    <View
                      key={topic.q}
                      style={idx < filteredTopics.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : undefined}
                    >
                      <TouchableOpacity
                        style={styles.topicRow}
                        onPress={() => setExpanded(open ? null : topic.q)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                      >
                        <Text style={[styles.topicQ, { color: colors.foreground }]}>{topic.q}</Text>
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      {open && (
                        <Text style={[styles.topicA, { color: colors.mutedForeground }]}>{topic.a}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Support form */}
          <View style={styles.sectionGroup}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contact support</Text>

            {submitted ? (
              <View style={[styles.successCard, { backgroundColor: colors.success + '12' }]}>
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                <Text style={[styles.successText, { color: colors.foreground }]}>
                  Support request submitted. Our team will follow up soon.
                </Text>
                <TouchableOpacity onPress={() => setSubmitted(false)} activeOpacity={0.7}>
                  <Text style={[styles.successLink, { color: colors.primary }]}>Submit another request</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, padding: 16, gap: 12 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Issue type</Text>
                <View style={styles.chipWrap}>
                  {ISSUE_TYPES.map((type) => {
                    const active = issueType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          setIssueType(type);
                          setError('');
                        }}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, { color: active ? '#fff' : colors.primary }]}>{type}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Message</Text>
                <TextInput
                  style={[styles.messageInput, { color: colors.foreground, backgroundColor: colors.input }]}
                  value={message}
                  onChangeText={(t) => {
                    setMessage(t);
                    setError('');
                  }}
                  placeholder="Tell us what's going on…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />

                {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.submitText}>Submit Support Request</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sectionGroup: { gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  noResults: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  topicQ: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  topicA: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  messageInput: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: 'Inter_400Regular', minHeight: 100, textAlignVertical: 'top' },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  submitBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, marginTop: 4 },
  submitText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  successCard: { alignItems: 'center', gap: 12, padding: 24, borderRadius: 20 },
  successText: { fontSize: 15, fontFamily: 'Inter_500Medium', textAlign: 'center', lineHeight: 22 },
  successLink: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
