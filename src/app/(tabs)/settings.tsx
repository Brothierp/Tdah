import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Chip, EmojiGrid, ErrorText, Field, Screen, Section, Segmented, Stepper, ToggleRow, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { backend } from '@/lib/backend';
import { confirm } from '@/lib/confirm';
import { useData } from '@/lib/data';
import { cancelAllForUser, ensurePermission, notificationsSupported } from '@/lib/notifications';
import { AGE_GROUPS, AVATARS } from '@/lib/theme';
import { useAppTheme } from '@/lib/useAppTheme';

const pad = (n: number) => String(n).padStart(2, '0');
const NUDGE_DELAYS = [5, 10, 15, 30];

export default function SettingsScreen() {
  const { user, parent, mode, updateProfile, logout, changePassword, deleteAccount } = useAuth();
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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [reward, setReward] = useState(settings.rewardLabel);

  if (!user) return null;

  const saveProfile = (patch: Parameters<typeof updateProfile>[0]) => {
    setProfileError(null);
    updateProfile(patch).catch((e: Error) => setProfileError(e.message));
  };

  const submitLogout = async () => {
    const pending = backend.pendingChanges();
    if (
      pending > 0 &&
      !(await confirm(
        'Modifications pas encore envoyées',
        `${pending} modification(s) n’ont pas encore pu être envoyées (pas de connexion). Si tu te déconnectes maintenant, elles seront perdues.`,
        'Me déconnecter quand même',
      ))
    ) {
      return;
    }
    await logout();
  };

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

      {parent && (
        <Card style={{ gap: 4, backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <Txt variant="subtitle">
            👀 Compte suivi par {parent.avatar} {parent.name}
          </Txt>
          <Txt variant="small">
            {parent.name} peut voir tes tâches, en ajouter et t’aider si tu oublies ton mot de passe.
          </Txt>
        </Card>
      )}

      <Section title="👤 Mon profil">
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
              onBlur={() => name.trim() && name.trim() !== user.name && saveProfile({ name })}
              maxLength={30}
            />
          </View>
        </View>
        {showAvatars && (
          <EmojiGrid
            options={AVATARS}
            value={user.avatar}
            onChange={(avatar) => {
              saveProfile({ avatar });
              setShowAvatars(false);
            }}
          />
        )}
        <Txt variant="muted">L’app est adaptée pour :</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AGE_GROUPS.filter((g) => !(parent && g.value === 'adulte')).map((g) => (
            <Chip
              key={g.value}
              label={`${g.emoji} ${g.label}`}
              selected={user.ageGroup === g.value}
              onPress={() => saveProfile({ ageGroup: g.value })}
            />
          ))}
        </View>
        <Txt variant="small">{user.email ? `E-mail : ${user.email}` : `Identifiant : ${user.username}`}</Txt>
        <ErrorText message={profileError} />
      </Section>

      {mode === 'cloud' && !parent && user.ageGroup !== 'adulte' && <LinkCodeCard />}

      <Section title="🌿 Affichage et confort">
        <Txt style={{ fontWeight: '700' }}>Écran d’accueil</Txt>
        <Segmented
          value={settings.homeView ?? (user.ageGroup === 'enfant' ? 'focus' : 'list')}
          onChange={(v) => updateSettings({ homeView: v })}
          options={[
            { value: 'focus', label: '🎯 Une à la fois' },
            { value: 'list', label: '📋 Ma journée' },
          ]}
        />
        <Txt style={{ fontWeight: '700' }}>Taille du texte</Txt>
        <Segmented
          value={settings.textSize}
          onChange={(v) => updateSettings({ textSize: v })}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'grand', label: 'Grand' },
            { value: 'tres-grand', label: 'Très grand' },
          ]}
        />
        <ToggleRow
          label="🌿 Mode calme"
          description="Couleurs plus douces, pas d’animations ni de confettis."
          value={settings.calmMode}
          onValueChange={(v) => updateSettings({ calmMode: v })}
        />
        <ToggleRow
          label="📳 Vibrations"
          description="Quand une tâche ou un timer est terminé."
          value={settings.hapticsEnabled}
          onValueChange={(v) => updateSettings({ hapticsEnabled: v })}
        />
      </Section>

      <Section title="⏳ Timer">
        <ToggleRow
          label="Prévenir avant la fin"
          description="Une alerte 1 minute avant la fin, pour se préparer à passer à autre chose."
          value={settings.timerWarning}
          onValueChange={(v) => updateSettings({ timerWarning: v })}
        />
        <ToggleRow
          label="Garder l’écran allumé"
          description="Pendant qu’un timer tourne."
          value={settings.keepScreenAwake}
          onValueChange={(v) => updateSettings({ keepScreenAwake: v })}
        />
      </Section>

      <Section title="🔔 Rappels">
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
          description="Chaque jour, un rappel du nombre de tâches qui t’attendent."
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
        <Txt variant="muted">Relancer si une tâche n’est pas faite, après :</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {NUDGE_DELAYS.map((m) => (
            <Chip key={m} label={`${m} min`} selected={settings.nudgeDelayMin === m} onPress={() => updateSettings({ nudgeDelayMin: m })} />
          ))}
        </View>
        <ErrorText message={permissionWarning} />
      </Section>

      <Section title="🎁 Récompense">
        <Txt variant="small">
          Chaque tâche faite donne une étoile ⭐. Choisis une récompense à gagner (à décider avec un parent, par exemple).
        </Txt>
        <ToggleRow
          label="Avoir un objectif"
          value={settings.rewardGoal != null}
          onValueChange={(v) => updateSettings({ rewardGoal: v ? 10 : null })}
        />
        {settings.rewardGoal != null && (
          <>
            <Stepper
              label="Étoiles à gagner"
              value={settings.rewardGoal}
              onChange={(v) => updateSettings({ rewardGoal: v })}
              min={5}
              max={100}
              step={5}
            />
            <Field
              label="La récompense"
              value={reward}
              onChangeText={setReward}
              onBlur={() => reward.trim() !== settings.rewardLabel && updateSettings({ rewardLabel: reward.trim() })}
              placeholder="ex : une sortie au parc, un film…"
              maxLength={40}
            />
          </>
        )}
      </Section>

      <Section title="🔑 Mon compte">
        <Txt style={{ fontWeight: '700' }}>Changer de mot de passe</Txt>
        <Field label="Mot de passe actuel" value={pwCurrent} onChangeText={setPwCurrent} secureTextEntry />
        <Field label="Nouveau mot de passe" value={pwNext} onChangeText={setPwNext} secureTextEntry />
        <ErrorText message={pwError} />
        {pwMessage ? <Txt style={{ color: colors.success, fontWeight: '600' }}>{pwMessage}</Txt> : null}
        <Button variant="secondary" label="Changer le mot de passe" onPress={submitPassword} disabled={!pwCurrent || !pwNext} />
        <Button variant="secondary" label="✨ Revoir l’accueil guidé" onPress={() => updateSettings({ onboarded: false }).then(() => router.navigate('/'))} />
        {!parent && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Txt style={{ fontWeight: '700', color: colors.danger }}>Supprimer mon compte</Txt>
            <Field label="Confirme avec ton mot de passe" value={deletePw} onChangeText={setDeletePw} secureTextEntry />
            <ErrorText message={deleteError} />
            <Button variant="danger" label="Supprimer définitivement" onPress={submitDelete} disabled={!deletePw} />
          </View>
        )}
      </Section>

      <Button label="🚪 Se déconnecter" variant="secondary" onPress={submitLogout} />
      <Button variant="ghost" label="Politique de confidentialité" onPress={() => router.push('/privacy')} />
    </Screen>
  );
}

/** Côté enfant / ado : code à donner au parent pour qu'il relie ce compte à sa famille. */
function LinkCodeCard() {
  const { createLinkCode } = useAuth();
  const { colors } = useAppTheme();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    try {
      setCode(await createLinkCode());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const until = code ? new Date(code.expiresAt) : null;
  return (
    <Card style={{ gap: 10 }}>
      <Txt variant="subtitle">👨‍👩‍👧 Relier mon compte à un parent</Txt>
      <Txt variant="small">
        Ton parent pourra voir tes tâches, t’en ajouter et t’aider si tu oublies ton mot de passe.
      </Txt>
      {code && until ? (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text
            selectable
            accessibilityLabel={`Code ${code.code.split('').join(' ')}`}
            style={{ fontSize: 40, fontWeight: '800', letterSpacing: 10, color: colors.primary }}
          >
            {code.code}
          </Text>
          <Txt variant="small">
            À saisir dans l’onglet Famille de ton parent, avant {String(until.getHours()).padStart(2, '0')}:
            {String(until.getMinutes()).padStart(2, '0')}.
          </Txt>
        </View>
      ) : null}
      <ErrorText message={error} />
      <Button variant="secondary" label={code ? 'Nouveau code' : 'Obtenir un code'} onPress={generate} />
    </Card>
  );
}
