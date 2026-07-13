import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useApp();
  const params = useLocalSearchParams<{ redirect?: string; join?: string }>();
  const redirect = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const join = Array.isArray(params.join) ? params.join[0] : params.join;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const handleSignIn = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError('');
    try {
      await signIn(email, password);
      if (redirect && join) {
        router.replace({ pathname: redirect, params: { join } } as any);
      } else if (redirect) {
        router.replace(redirect as any);
      } else {
        router.replace('/(tabs)' as any);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Sign in failed. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.inner, { paddingTop: topPad + 16, paddingBottom: insets.bottom + 32 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <Image
          source={require('@/assets/images/logo-horizontal.png')}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityLabel="Let's Feast"
        />

        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to Let's Feast</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email address</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="name@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            </View>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            <TouchableOpacity activeOpacity={0.7} style={styles.forgotBtn}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSignIn} activeOpacity={0.85}>
            <Text style={styles.submitBtnText}>Log In</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={[styles.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8}>
              <Ionicons name="logo-google" size={20} color="#EA4335" />
              <Text style={[styles.socialText, { color: colors.foreground }]}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={20} color={colors.foreground} />
              <Text style={[styles.socialText, { color: colors.foreground }]}>Apple</Text>
            </TouchableOpacity>
          </View>

        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.signUpLink} onPress={() => router.replace('/signup' as any)} activeOpacity={0.7}>
            <Text style={[styles.signUpText, { color: colors.mutedForeground }]}>New to Let's Feast? </Text>
            <Text style={[styles.signUpText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  backBtn: { marginBottom: 16, width: 40 },
  brandLogo: { width: 200, height: 105, alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 32 },
  form: { gap: 20 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 4 },
  forgotText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, fontFamily: 'Inter_400Regular' },
  error: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  submitBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 8 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  socialRow: { flexDirection: 'row', gap: 16 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  socialText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  footer: { paddingTop: 24 },
  signUpLink: { flexDirection: 'row', justifyContent: 'center' },
  signUpText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
});
