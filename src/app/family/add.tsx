import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, EmojiGrid, ErrorText, Field, Screen, Txt } from '@/components/ui';
import { MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth';
import { AGE_GROUPS, AVATARS } from '@/lib/theme';
import type { AgeGroup } from '@/lib/types';

/** Ajouter un enfant : créer son compte, ou relier un compte existant. */
export default function AddChild() {
  const { createChild, linkChild, mode: backendMode } = useAuth();
  const cloud = backendMode === 'cloud';
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('enfant');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const child =
        mode === 'create'
          ? await createChild({ name, username, password, avatar, ageGroup })
          : await linkChild(cloud ? { code } : { username, password });
      router.replace(`/family/${child.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Nouveau compte" selected={mode === 'create'} onPress={() => setMode('create')} />
        <Chip label="Compte existant" selected={mode === 'link'} onPress={() => setMode('link')} />
      </View>

      {mode === 'create' ? (
        <>
          <Field label="Prénom de l’enfant" value={name} onChangeText={setName} placeholder="ex : Léo" />
          <Field
            label="Identifiant (pour qu’il se connecte)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ex : leo"
          />
          <Field
            label={`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum)`}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <View style={{ gap: 8 }}>
            <Txt variant="muted">Avatar</Txt>
            <EmojiGrid options={AVATARS} value={avatar} onChange={setAvatar} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {AGE_GROUPS.filter((g) => g.value !== 'adulte').map((g) => (
              <Chip key={g.value} label={`${g.emoji} ${g.label}`} selected={ageGroup === g.value} onPress={() => setAgeGroup(g.value)} />
            ))}
          </View>
        </>
      ) : cloud ? (
        <>
          <Txt variant="muted">
            Sur le téléphone de l’enfant (ou de l’ado) : Réglages › « Relier mon compte à un parent ». Un code à 6
            chiffres s’affiche : saisis-le ici. Il est valable 15 minutes.
          </Txt>
          <Field
            label="Code de liaison"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="123456"
            style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }}
          />
        </>
      ) : (
        <>
          <Txt variant="muted">
            L’enfant (ou l’ado) a déjà un compte sur cet appareil ? Saisis son identifiant et son mot de passe pour le
            relier à ta famille.
          </Txt>
          <Field
            label="Identifiant de l’enfant"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field label="Son mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
        </>
      )}

      <ErrorText message={error} />
      <Button
        label={busy ? 'Un instant…' : mode === 'create' ? 'Créer le compte' : 'Relier le compte'}
        onPress={submit}
        disabled={busy || (mode === 'link' && cloud ? code.length !== 6 : !username || !password)}
      />
    </Screen>
  );
}
