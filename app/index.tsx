import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';

const DEEP_RED = '#89181A';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading, isOnboarded } = useApp();

  useEffect(() => {
    if (!isLoading) {
      if (user && isOnboarded) {
        router.replace('/(tabs)' as any);
      } else if (user && !isOnboarded) {
        router.replace('/onboarding' as any);
      }
    }
  }, [isLoading, user, isOnboarded]);

  if (isLoading) return null;

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 24) : insets.top;

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/welcome-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      />
      <View style={styles.scrim} />

      <View style={[styles.content, { paddingTop: topPad + 24, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/logo-horizontal.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Let's Feast"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            onPress={() => router.push('/signin' as any)}
          >
            <Text style={[styles.btnText, { color: DEEP_RED }]}>LOG IN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            onPress={() => router.push('/signup' as any)}
          >
            <Text style={[styles.btnText, { color: DEEP_RED }]}>I'M NEW HERE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            onPress={() => router.push('/signin' as any)}
            style={styles.forgotWrap}
          >
            <Text style={[styles.forgotText, { color: DEEP_RED }]}>FORGOT PASSWORD</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    opacity: 0.82,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1024 / 535,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  btn: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(137,24,26,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  btnText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  forgotWrap: {
    marginTop: 6,
    paddingVertical: 6,
  },
  forgotText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
  },
});
