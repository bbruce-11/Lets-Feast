import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useFeastWindowContext } from '@/context/FeastWindowContext';
import { createFeastWindowAlertListener } from '@/lib/feastWindowToast';

type NotificationKind = 'info' | 'warning' | 'success';

interface NotificationOptions {
  icon?: keyof typeof Ionicons.glyphMap;
  kind?: NotificationKind;
  durationMs?: number;
  onPress?: () => void;
}

interface ActiveNotification extends Required<Omit<NotificationOptions, 'durationMs' | 'onPress'>> {
  key: number;
  message: string;
  durationMs: number;
  onPress?: () => void;
}

interface NotificationContextType {
  notify: (message: string, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const DEFAULT_DURATION = 4000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { feastWindows, subscribe, joinedWindowIds } = useFeastWindowContext();
  const { restaurants } = useRestaurants();
  const [active, setActive] = useState<ActiveNotification | null>(null);
  const keyRef = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accumulate window -> restaurant id mappings so a window can still be
  // resolved after FeastWindowContext removes it (e.g. on expiry).
  const windowRestaurantRef = useRef<Map<string, string>>(new Map());
  const restaurantNameRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const fw of feastWindows) {
      windowRestaurantRef.current.set(fw.id, fw.restaurantId);
    }
  }, [feastWindows]);

  useEffect(() => {
    for (const r of restaurants) {
      restaurantNameRef.current.set(r.id, r.name);
    }
  }, [restaurants]);

  // Keep the latest joined-window ids in a ref so the WS subscription can read
  // them without resubscribing every time the joined set changes.
  const joinedWindowIdsRef = useRef<string[]>(joinedWindowIds);
  useEffect(() => {
    joinedWindowIdsRef.current = joinedWindowIds;
  }, [joinedWindowIds]);

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearDismissTimer();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -100, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setActive(null);
    });
  }, [clearDismissTimer, opacity, translateY]);

  const notify = useCallback(
    (message: string, options?: NotificationOptions) => {
      clearDismissTimer();
      keyRef.current += 1;
      const duration = options?.durationMs ?? DEFAULT_DURATION;
      setActive({
        key: keyRef.current,
        message,
        icon: options?.icon ?? 'notifications',
        kind: options?.kind ?? 'info',
        durationMs: duration,
        onPress: options?.onPress,
      });
      translateY.setValue(-100);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      dismissTimer.current = setTimeout(() => hide(), duration);
    },
    [clearDismissTimer, hide, opacity, translateY],
  );

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  useEffect(() => {
    const listener = createFeastWindowAlertListener({
      notify: (message, options) =>
        notify(message, {
          icon: options.icon as keyof typeof Ionicons.glyphMap,
          kind: options.kind,
          durationMs: options.durationMs,
          onPress: options.onPress,
        }),
      navigate: (route) => router.push(route as any),
      resolveRestaurant: (windowId) => {
        const id = windowId
          ? windowRestaurantRef.current.get(windowId)
          : undefined;
        const name = id ? restaurantNameRef.current.get(id) : undefined;
        return { id, name };
      },
      isJoined: (windowId) =>
        windowId ? joinedWindowIdsRef.current.includes(windowId) : false,
    });

    return subscribe(listener);
  }, [subscribe, notify, router]);

  const accent =
    active?.kind === 'warning'
      ? colors.gold
      : active?.kind === 'success'
        ? colors.success
        : colors.primary;

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {active && (
        <Animated.View
          style={[
            styles.overlay,
            { top: insets.top + 8 },
            { transform: [{ translateY }], opacity },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              active.onPress?.();
              hide();
            }}
            style={[styles.toast, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: accent }]}>
              <Ionicons name={active.icon} size={16} color="#fff" />
            </View>
            <Text style={[styles.message, { color: colors.foreground }]} numberOfLines={2}>
              {active.message}
            </Text>
            <Ionicons name="close" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be within NotificationProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
});
