import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Chip, EmojiGrid, ErrorText, Field, Screen, Txt } from '@/components/ui';
import { MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth';
import { AGE_GROUPS, AVATARS } from '@/lib/theme';
import type { AgeGroup } from '@/lib/types';

export default function Register() {
  const { register, mode } = useAuth();
  const cloud = mode === 'cloud';
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('adulte');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  // En ligne, les comptes « Enfant » sont créés par un parent (consentement parental).
  const ageChoices = cloud ? AGE_GROUPS.filter((g) => g.value !== 'enfant') : AGE_GROUPS;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await register({
        name,
        password,
        avatar,
        ageGroup,
        ...(cloud ? { email: login } : { username: login }),
      });
      if ('needsEmailConfirmation' in result) {
        setConfirmEmail(true);
        setBusy(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (confirmEmail) {
    return (
      <Screen edges={[]}>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <Text style={{ fontSize: 48 }}>📬</Text>
          <Txt variant="subtitle">Vérifie ta boîte mail</Txt>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            On t’a envoyé un lien à {login.trim()}. Clique dessus, puis reviens te connecter.
          </Txt>
        </Card>
        <Button label="Se connecter" onPress={() => router.replace({ pathname: '/login', params: { login: login.trim() } })} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <Field label="Ton prénom" value={name} onChangeText={setName} placeholder="ex : Léo" autoComplete="given-name" maxLength={30} />
      {cloud ? (
        <Field
          label="Ton e-mail (pour te connecter)"
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          placeholder="ex : prenom@mail.fr"
        />
      ) : (
        <Field
          label="Identifiant (pour te connecter)"
          value={login}
          onChangeText={setLogin}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          placeholder="ex : leo"
        />
      )}
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
          {ageChoices.map((g) => (
            <Chip key={g.value} label={`${g.emoji} ${g.label}`} selected={ageGroup === g.value} onPress={() => setAgeGroup(g.value)} />
          ))}
        </View>
        {cloud && (
          <Txt variant="small">
            Pour un enfant : un parent crée son compte depuis l’onglet Famille de son propre compte.
          </Txt>
        )}
      </View>

      <ErrorText message={error} />
      <Button label={busy ? 'Création…' : "C'est parti ! 🚀"} onPress={submit} disabled={busy} />
      <Txt variant="small" style={{ textAlign: 'center' }}>
        {cloud
          ? 'Tes données sont enregistrées en ligne pour les retrouver sur tous tes appareils.'
          : 'Tes données restent sur cet appareil et sont séparées de celles des autres comptes.'}
      </Txt>
      <Button variant="ghost" label="Politique de confidentialité" onPress={() => router.push('/privacy')} />
    </Screen>
  );
}
