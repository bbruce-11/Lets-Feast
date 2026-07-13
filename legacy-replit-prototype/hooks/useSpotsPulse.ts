import { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';

export function useSpotsPulse(spotsLeft: number): Animated.Value {
  const scale = useRef(new Animated.Value(1)).current;
  const prevSpots = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevSpots.current;
    prevSpots.current = spotsLeft;
    if (prev === null || spotsLeft >= prev) return;

    const useNativeDriver = Platform.OS !== 'web';
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 140, useNativeDriver }),
      Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver }),
      Animated.timing(scale, { toValue: 1.15, duration: 120, useNativeDriver }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver }),
    ]).start();
  }, [spotsLeft, scale]);

  return scale;
}
