import { fontSize, palette, radius, spacing } from '@escala/ui';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/logo';
import { API_URL } from '@/lib/config';
import { fetchHealth } from '@/lib/health';
import { useColors } from '@/lib/theme';

/** Tela provisória da Fase 1: prova que app, contrato compartilhado e API estão ligados. */
export default function HomeScreen() {
  const colors = useColors();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchHealth(API_URL),
    retry: 1,
  });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <LogoMark />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Escala
        </Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>
          O turno certo. A equipe certa.
        </Text>
      </View>

      <View
        accessibilityLiveRegion="polite"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {health.isPending && (
          <View style={styles.row}>
            <ActivityIndicator color={colors.textMuted} />
            <Text style={[styles.body, { color: colors.textMuted }]}>Conectando ao servidor…</Text>
          </View>
        )}

        {health.isSuccess && (
          <Text style={[styles.body, { color: colors.text }]}>
            Servidor conectado, versão {health.data.version}.
          </Text>
        )}

        {health.isError && (
          <View style={styles.errorBlock}>
            <Text style={[styles.body, { color: colors.text }]}>
              Não foi possível falar com o servidor. Verifique sua conexão.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={health.isFetching}
              onPress={() => void health.refetch()}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.accent, opacity: pressed || health.isFetching ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.buttonText}>
                {health.isFetching ? 'Tentando…' : 'Tentar de novo'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.xl },
  hero: { gap: spacing.sm },
  title: { fontSize: fontSize.display, fontWeight: '700', marginTop: spacing.sm },
  tagline: { fontSize: fontSize.body },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { fontSize: fontSize.body, flexShrink: 1 },
  errorBlock: { gap: spacing.md },
  button: {
    minHeight: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontSize: fontSize.body, fontWeight: '600', color: palette.ink },
});
