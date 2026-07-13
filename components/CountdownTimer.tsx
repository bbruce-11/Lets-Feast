import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  endTime: number;
  onExpire?: () => void;
  style?: object;
  compact?: boolean;
}

export default function CountdownTimer({ endTime, onExpire, style, compact = false }: Props) {
  const colors = useColors();
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()));

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const interval = setInterval(() => {
      const r = Math.max(0, endTime - Date.now());
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (remaining <= 0) {
    return <Text style={[styles.expired, { color: colors.mutedForeground }, style]}>Expired</Text>;
  }

  return (
    <Text style={[styles.timer, { color: colors.primary, fontSize: compact ? 13 : 15 }, style]}>
      {formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  timer: { fontFamily: 'Inter_700Bold' },
  expired: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
