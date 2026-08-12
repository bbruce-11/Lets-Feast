import { useState } from 'react';
import { Link, router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
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

export default function SignInScreen() {
  const colors = useColors();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
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
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { color: colors.foreground }]}>Let's Feast</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to order</Text>

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
          disabled={isSubmitting || !email || !password}
          activeOpacity={0.85}
          style={[styles.button, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <Link href="/signup" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>
              New here?{' '}
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Create an account</Text>
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
  logo: { width: 56, height: 52, alignSelf: 'center', marginBottom: 4 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_400Regular' },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  error: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium' },
  link: { marginTop: 20, alignItems: 'center' },
});
