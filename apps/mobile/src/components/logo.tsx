import { palette, spacing } from '@escala/ui';
import { StyleSheet, View } from 'react-native';

/** Marca do protótipo: três turnos escalonados. */
export function LogoMark() {
  return (
    <View style={styles.mark} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.bar, { backgroundColor: palette.coral }]} />
      <View style={[styles.bar, styles.offset, { backgroundColor: palette.amber }]} />
      <View style={[styles.bar, { backgroundColor: palette.lime }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 56, gap: spacing.xs },
  bar: { width: 40, height: 12, borderRadius: 6 },
  offset: { marginLeft: 16 },
});
