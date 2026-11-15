import { useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/useAppTheme';

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  onRefresh,
  background,
}: {
  children: ReactNode;
  /** Fond de l'écran (par défaut : fond du thème). */
  background?: string;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
  /** Active « tirer pour actualiser ». */
  onRefresh?: () => Promise<unknown>;
}) {
  const { colors } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      tintColor={colors.primary}
      colors={[colors.primary]}
      onRefresh={async () => {
        setRefreshing(true);
        await onRefresh().catch(() => {});
        setRefreshing(false);
      }}
    />
  ) : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background ?? colors.background }} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TxtVariant = 'title' | 'subtitle' | 'body' | 'muted' | 'small' | 'label';

export function Txt({
  children,
  variant = 'body',
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: TxtVariant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors, fontScale } = useAppTheme();
  const base: Record<TxtVariant, TextStyle> = {
    title: { fontSize: 28, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: 19, fontWeight: '700', color: colors.text },
    body: { fontSize: 16, color: colors.text },
    muted: { fontSize: 15, color: colors.textMuted },
    small: { fontSize: 13, color: colors.textMuted },
    /** Petit titre de section en capitales : structure la page sans l'alourdir. */
    label: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  };
  const v = base[variant];
  return (
    <Text numberOfLines={numberOfLines} style={[v, { fontSize: (v.fontSize ?? 16) * fontScale }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius, padding: 16 }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  accessibilityLabel,
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  size?: 'md' | 'sm';
}) {
  const { colors, radius, fontScale } = useAppTheme();
  const small = size === 'sm';
  const palette = {
    primary: { bg: colors.primaryFill, fg: colors.onFill },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    success: { bg: colors.successFill, fg: colors.onFill },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        small ? styles.buttonSm : styles.button,
        { backgroundColor: palette.bg, borderRadius: radius, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={{ color: palette.fg, fontSize: (small ? 15 : 17) * fontScale, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors, radius, fontScale } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="muted">{label}</Txt>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 17 * fontScale,
            color: colors.text,
          },
          props.style,
        ]}
      />
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt>{label}</Txt>
        {description ? <Txt variant="small">{description}</Txt> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { colors, fontScale } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.primaryFill : colors.card, borderColor: selected ? colors.primaryFill : colors.border },
      ]}
    >
      <Text style={{ color: selected ? colors.onFill : colors.text, fontWeight: selected ? '700' : '600', fontSize: 15 * fontScale }}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  label: string;
}) {
  const { colors } = useAppTheme();
  const wrap = (v: number) => (v > max ? min : v < min ? max : v);
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Txt variant="small">{label}</Txt>
      <View style={styles.stepper}>
        <RoundButton label="−" accessibilityLabel={`${label} moins`} onPress={() => onChange(wrap(value - step))} />
        <Txt variant="subtitle" style={{ minWidth: 48, textAlign: 'center', color: colors.text }}>
          {format(value)}
        </Txt>
        <RoundButton label="+" accessibilityLabel={`${label} plus`} onPress={() => onChange(wrap(value + step))} />
      </View>
    </View>
  );
}

export function RoundButton({
  label,
  onPress,
  accessibilityLabel,
  size = 40,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  size?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: colors.primary, fontSize: size * 0.5, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

export function EmojiGrid({ options, value, onChange }: { options: string[]; value: string; onChange: (e: string) => void }) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={styles.emojiGrid}>
      {options.map((e) => (
        <Pressable
          key={e}
          accessibilityRole="button"
          accessibilityState={{ selected: e === value }}
          accessibilityLabel={`Choisir ${e}`}
          onPress={() => onChange(e)}
          style={{
            width: 52,
            height: 52,
            borderRadius: radius * 0.7,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: e === value ? colors.primarySoft : colors.card,
            borderWidth: 2,
            borderColor: e === value ? colors.primary : colors.border,
          }}
        >
          <Text style={{ fontSize: 26 }}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const { colors } = useAppTheme();
  if (!message) return null;
  return <Txt style={{ color: colors.danger, fontWeight: '600' }}>{message}</Txt>;
}

/** Choix entre 2 ou 3 options, toujours visibles (pas de menu caché). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, radius, fontScale } = useAppTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: colors.primarySoft, borderRadius: radius }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, { borderRadius: radius - 4, backgroundColor: selected ? colors.card : 'transparent' }]}
          >
            <Text
              numberOfLines={2}
              style={{ fontSize: 15 * fontScale, fontWeight: '700', color: selected ? colors.text : colors.textMuted, textAlign: 'center' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Carte repliable : on n'affiche que ce dont on a besoin (moins de surcharge visuelle). */
export function Section({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Card style={{ gap: open ? 12 : 0, paddingVertical: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.sectionHeader}
      >
        <Txt variant="subtitle" style={{ flex: 1 }}>
          {title}
        </Txt>
        <Text style={{ color: colors.textMuted, fontSize: 18, fontWeight: '800' }}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? <View style={{ gap: 12, paddingBottom: 12 }}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 11, paddingHorizontal: 6, justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 8 },
  screen: { paddingHorizontal: 18, paddingTop: 16, gap: 18, paddingBottom: 110, width: '100%', maxWidth: 640, alignSelf: 'center' },
  button: { paddingVertical: 15, paddingHorizontal: 20, minHeight: 54, justifyContent: 'center' },
  buttonSm: { paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

/** Bouton « + » flottant : toujours au même endroit, pour ajouter sans chercher. */
export function Fab({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primaryFill,
          opacity: pressed ? 0.85 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
      ]}
    >
      <Text style={{ color: colors.onFill, fontSize: 34, fontWeight: '600', marginTop: -2 }}>+</Text>
    </Pressable>
  );
}

/** Lien « Retour » en haut des écrans qui ne sont pas des onglets (timer, famille). */
export function BackLink({ label = 'Retour', onPress }: { label?: string; onPress: () => void }) {
  const { colors, fontScale } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Text style={{ color: colors.primary, fontSize: 17 * fontScale, fontWeight: '700' }}>‹ {label}</Text>
    </Pressable>
  );
}
