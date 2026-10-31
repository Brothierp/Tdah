import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, EmojiGrid, ErrorText, Field, Screen, Txt } from '@/components/ui';
import { MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth';
import { AGE_GROUPS, AVATARS } from '@/lib/theme';
import type { AgeGroup } from '@/lib/types';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('adulte');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await register({ name, username, password, avatar, ageGroup });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Field label="Ton prénom" value={name} onChangeText={setName} placeholder="ex : Léo" autoComplete="given-name" />
      <Field
        label="Identifiant (pour te connecter)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        placeholder="ex : leo"
      />
      <Field
        label={`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum)`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      <View style={{ gap: 8 }}>
        <Txt variant="muted">Choisis ton avatar</Txt>
        <EmojiGrid options={AVATARS} value={avatar} onChange={setAvatar} />
      </View>

      <View style={{ gap: 8 }}>
        <Txt variant="muted">L’app s’adapte à toi</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {AGE_GROUPS.map((g) => (
            <Chip key={g.value} label={`${g.emoji} ${g.label}`} selected={ageGroup === g.value} onPress={() => setAgeGroup(g.value)} />
          ))}
        </View>
      </View>

      <ErrorText message={error} />
      <Button label={busy ? 'Création…' : "C'est parti ! 🚀"} onPress={submit} disabled={busy} />
      <Txt variant="small" style={{ textAlign: 'center' }}>
        Tes données restent sur cet appareil et sont séparées de celles des autres comptes.
      </Txt>
    </Screen>
  );
}
