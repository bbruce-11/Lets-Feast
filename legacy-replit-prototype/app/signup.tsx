import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useApp();

  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '', confirm: '', zip: '', referral: '' });
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleCreate = async () => {
    if (!form.fullName || !form.phone || !form.email || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    try {
      await signUp({ fullName: form.fullName, phone: form.phone, email: form.email, zipCode: form.zip, password: form.password, referralCode: form.referral });
      router.replace('/onboarding' as any);
    } catch (err: any) {
      setError(err?.message ?? 'Sign up failed. Please try again.');
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 32 }}>
        <View style={styles.inner}>
          {/* Header */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>

          <Image
            source={require('@/assets/images/logo-horizontal.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Let's Feast"
          />

          <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join Let's Feast</Text>

          {/* Fields */}
          <View style={styles.form}>
            {[
              { key: 'fullName', label: 'Full Name', placeholder: 'Jane Smith', icon: 'person-outline', keyboard: 'default' },
              { key: 'phone', label: 'Phone Number', placeholder: '(312) 555-0100', icon: 'call-outline', keyboard: 'phone-pad' },
              { key: 'email', label: 'Email Address', placeholder: 'jane@example.com', icon: 'mail-outline', keyboard: 'email-address' },
              { key: 'password', label: 'Password', placeholder: '••••••••', icon: 'lock-closed-outline', secure: true, keyboard: 'default' },
              { key: 'confirm', label: 'Confirm Password', placeholder: '••••••••', icon: 'lock-closed-outline', secure: true, keyboard: 'default' },
              { key: 'zip', label: 'Zip Code', placeholder: '60647', icon: 'location-outline', keyboard: 'numeric' },
            ].map(({ key, label, placeholder, icon, secure, keyboard }) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
                <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Ionicons name={icon as any} size={20} color={colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={secure}
                    value={form[key as keyof typeof form]}
                    onChangeText={set(key as keyof typeof form)}
                    keyboardType={keyboard as any}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                  />
                </View>
              </View>
            ))}

            {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleCreate} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>Sign Up</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signInLink} onPress={() => router.replace('/signin' as any)} activeOpacity={0.7}>
              <Text style={[styles.signInText, { color: colors.mutedForeground }]}>Already have an account? </Text>
              <Text style={[styles.signInText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 16, width: 40 },
  brandLogo: { width: 200, height: 105, alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 32 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, fontFamily: 'Inter_400Regular' },
  error: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  submitBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17 },
  signInLink: { flexDirection: 'row', justifyContent: 'center', paddingTop: 16, paddingBottom: 32 },
  signInText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
});
