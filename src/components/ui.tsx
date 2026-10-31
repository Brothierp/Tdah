import type { ReactNode } from 'react';
import {
  Pressable,
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
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TxtVariant = 'title' | 'subtitle' | 'body' | 'muted' | 'small';

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
    <View style={[{ backgroundColor: colors.card, borderRadius: radius, padding: 16, borderWidth: 1, borderColor: colors.border }, style]}>
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
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors, radius, fontScale } = useAppTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    danger: { bg: colors.danger, fg: '#FFFFFF' },
    ghost: { bg: 'transparent', fg: colors.primary },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderRadius: radius, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={{ color: palette.fg, fontSize: 17 * fontScale, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
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
        { backgroundColor: selected ? colors.primary : colors.primarySoft, borderColor: selected ? colors.primary : colors.border },
      ]}
    >
      <Text style={{ color: selected ? colors.primaryText : colors.primary, fontWeight: '700', fontSize: 15 * fontScale }}>{label}</Text>
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

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  button: { paddingVertical: 15, paddingHorizontal: 20, minHeight: 52, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
