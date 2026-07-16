import { useState } from 'react';
import { Link, router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function SignUpScreen() {
  const colors = useColors();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!fullName || !email || !password) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await signUp({ fullName: fullName.trim(), email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.navy }]}>Create account</Text>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
        />

        {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !fullName || !email || !password}
          style={[styles.button, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Create Account</Text>
          )}
        </TouchableOpacity>

        <Link href="/signin" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={{ color: colors.mutedForeground }}>
              Already have an account? <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  error: { textAlign: 'center', fontSize: 14 },
  link: { marginTop: 20, alignItems: 'center' },
});
