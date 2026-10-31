import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ErrorText, Field, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const params = useLocalSearchParams<{ login?: string }>();
  const { login, accounts, mode } = useAuth();
  const [username, setUsername] = useState(params.login ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const known = accounts.find((a) => a.login === params.login);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      {known ? (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 56 }}>{known.avatar}</Text>
          <Txt variant="subtitle">Salut {known.name} !</Txt>
        </View>
      ) : (
        <Field
          label={mode === 'cloud' ? 'E-mail (ou identifiant pour un enfant)' : 'Identifiant'}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'cloud' ? 'email' : 'username'}
          keyboardType={mode === 'cloud' ? 'email-address' : 'default'}
          placeholder={mode === 'cloud' ? 'ex : prenom@mail.fr ou leo' : 'ex : leo'}
        />
      )}
      <Field
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
        autoFocus={!!known}
      />
      <ErrorText message={error} />
      <Button label={busy ? 'Connexion…' : 'Se connecter'} onPress={submit} disabled={busy || !username || !password} />
    </Screen>
  );
}
