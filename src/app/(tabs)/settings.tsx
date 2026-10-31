import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, EmojiGrid, ErrorText, Field, Screen, Stepper, ToggleRow, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { useData } from '@/lib/data';
import { cancelAllForUser, ensurePermission, notificationsSupported } from '@/lib/notifications';
import { AGE_GROUPS, AVATARS } from '@/lib/theme';
import { useAppTheme } from '@/lib/useAppTheme';

const pad = (n: number) => String(n).padStart(2, '0');
const NUDGE_DELAYS = [5, 10, 15, 30];

export default function SettingsScreen() {
  const { user, updateProfile, logout, changePassword, deleteAccount } = useAuth();
  const { settings, updateSettings } = useData();
  const { colors } = useAppTheme();
  const [name, setName] = useState(user?.name ?? '');
  const [showAvatars, setShowAvatars] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);

  if (!user) return null;

  const toggleReminders = async (key: 'remindersEnabled' | 'dailySummaryEnabled', value: boolean) => {
    setPermissionWarning(null);
    if (value && notificationsSupported && !(await ensurePermission())) {
      setPermissionWarning('Les notifications sont bloquées : autorise-les dans les réglages du téléphone.');
    }
    await updateSettings({ [key]: value });
  };

  const submitPassword = async () => {
    setPwError(null);
    setPwMessage(null);
    try {
      await changePassword(pwCurrent, pwNext);
      setPwCurrent('');
      setPwNext('');
      setPwMessage('Mot de passe modifié ✅');
    } catch (e) {
      setPwError((e as Error).message);
    }
  };

  const submitDelete = async () => {
    setDeleteError(null);
    if (!(await confirm('Supprimer ton compte ?', 'Toutes tes tâches et tes réglages seront effacés. C’est définitif.', 'Supprimer'))) {
      return;
    }
    try {
      const id = user.id;
      await deleteAccount(deletePw);
      await cancelAllForUser(id);
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  };

  return (
    <Screen>
      <Txt variant="title">⚙️ Réglages</Txt>

      <Card style={{ gap: 12 }}>
        <Txt variant="subtitle">👤 Mon profil</Txt>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <Button
            variant="secondary"
            label={user.avatar}
            accessibilityLabel="Changer d'avatar"
            onPress={() => setShowAvatars((s) => !s)}
            style={{ width: 64 }}
          />
          <View style={{ flex: 1 }}>
            <Field
              label="Prénom"
              value={name}
              onChangeText={setName}
              onBlur={() => name.trim() && name.trim() !== user.name && updateProfile({ name })}
              maxLength={30}
            />
          </View>
        </View>
        {showAvatars && (
          <EmojiGrid
            options={AVATARS}
            value={user.avatar}
            onChange={(avatar) => {
              updateProfile({ avatar });
              setShowAvatars(false);
            }}
          />
        )}
        <Txt variant="muted">Affichage adapté pour :</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AGE_GROUPS.map((g) => (
            <Chip
              key={g.value}
              label={`${g.emoji} ${g.label}`}
              selected={user.ageGroup === g.value}
              onPress={() => updateProfile({ ageGroup: g.value })}
            />
          ))}
        </View>
        <Txt variant="small">Identifiant : {user.username}</Txt>
      </Card>

      <Card style={{ gap: 8 }}>
        <Txt variant="subtitle">🔔 Rappels</Txt>
        {!notificationsSupported && (
          <Txt variant="small">Les rappels fonctionnent sur l’application mobile (iOS / Android).</Txt>
        )}
        <ToggleRow
          label="Activer les rappels"
          description="Interrupteur général. Coupé = aucune notification de tâche."
          value={settings.remindersEnabled}
          onValueChange={(v) => toggleReminders('remindersEnabled', v)}
        />
        <ToggleRow
          label="Résumé du jour"
          description="Chaque jour, un rappel du nombre de tâches qui t'attendent."
          value={settings.dailySummaryEnabled}
          onValueChange={(v) => toggleReminders('dailySummaryEnabled', v)}
          disabled={!settings.remindersEnabled}
        />
        {settings.remindersEnabled && settings.dailySummaryEnabled && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 4 }}>
            <Stepper
              label="Heure"
              value={settings.dailySummaryHour}
              onChange={(v) => updateSettings({ dailySummaryHour: v })}
              min={0}
              max={23}
              format={pad}
            />
            <Stepper
              label="Minutes"
              value={settings.dailySummaryMinute}
              onChange={(v) => updateSettings({ dailySummaryMinute: v })}
              min={0}
              max={45}
              step={15}
              format={pad}
            />
          </View>
        )}
        <Txt variant="muted">Délai de relance si une tâche n’est pas faite :</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {NUDGE_DELAYS.map((m) => (
            <Chip key={m} label={`${m} min`} selected={settings.nudgeDelayMin === m} onPress={() => updateSettings({ nudgeDelayMin: m })} />
          ))}
        </View>
        <ErrorText message={permissionWarning} />
      </Card>

      <Card style={{ gap: 8 }}>
        <Txt variant="subtitle">⏳ Timer</Txt>
        <ToggleRow
          label="Vibrations"
          description="Une petite vibration quand une tâche ou un timer est terminé."
          value={settings.hapticsEnabled}
          onValueChange={(v) => updateSettings({ hapticsEnabled: v })}
        />
        <ToggleRow
          label="Garder l'écran allumé"
          description="Pendant qu'un timer tourne."
          value={settings.keepScreenAwake}
          onValueChange={(v) => updateSettings({ keepScreenAwake: v })}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt variant="subtitle">🔑 Mot de passe</Txt>
        <Field label="Mot de passe actuel" value={pwCurrent} onChangeText={setPwCurrent} secureTextEntry />
        <Field label="Nouveau mot de passe" value={pwNext} onChangeText={setPwNext} secureTextEntry />
        <ErrorText message={pwError} />
        {pwMessage ? <Txt style={{ color: colors.success, fontWeight: '600' }}>{pwMessage}</Txt> : null}
        <Button variant="secondary" label="Changer le mot de passe" onPress={submitPassword} disabled={!pwCurrent || !pwNext} />
      </Card>

      <Button label="🚪 Se déconnecter" variant="secondary" onPress={logout} />

      <Card style={{ gap: 10, borderColor: colors.danger }}>
        <Txt variant="subtitle">Supprimer mon compte</Txt>
        <Field label="Confirme avec ton mot de passe" value={deletePw} onChangeText={setDeletePw} secureTextEntry />
        <ErrorText message={deleteError} />
        <Button variant="danger" label="Supprimer définitivement" onPress={submitDelete} disabled={!deletePw} />
      </Card>
    </Screen>
  );
}
