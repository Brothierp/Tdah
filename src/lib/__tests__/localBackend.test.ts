import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocalBackend } from '../backend/local';

const adult = { name: 'Maman', username: 'maman', password: 'secret123', avatar: '🐼', ageGroup: 'adulte' as const };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('backend local', () => {
  it('inscription, connexion, mauvais mot de passe', async () => {
    const be = createLocalBackend();
    await be.register(adult);
    await be.logout();
    await expect(be.login('maman', 'faux')).rejects.toThrow('incorrect');
    const me = await be.login('  MAMAN ', 'secret123');
    expect(me.name).toBe('Maman');
    expect(JSON.stringify(await AsyncStorage.getItem('focus:users'))).not.toContain('secret123');
  });

  it('refuse un identifiant déjà pris ou un mot de passe trop court', async () => {
    const be = createLocalBackend();
    await be.register(adult);
    await expect(be.register({ ...adult, name: 'Autre' })).rejects.toThrow('déjà utilisé');
    await expect(be.register({ ...adult, username: 'papa', password: '123' })).rejects.toThrow('6 caractères');
  });

  it('isole les données de chaque compte', async () => {
    const be = createLocalBackend();
    const { account } = (await be.register(adult)) as { account: { id: string } };
    await be.saveTasks(account.id, [], [{ id: 't1' } as never]);
    await be.logout();
    const other = (await be.register({ ...adult, username: 'papa' })) as { account: { id: string } };
    expect(await be.loadTasks(other.account.id)).toEqual([]);
    expect(await be.loadTasks(account.id)).toHaveLength(1);
  });

  it('famille : créer, relier, réinitialiser, supprimer', async () => {
    const be = createLocalBackend();
    await be.register(adult);
    const leo = await be.createChild({ name: 'Léo', username: 'leo', password: 'leo123', avatar: '🦊', ageGroup: 'enfant' });
    expect(leo.parentId).toBeDefined();
    expect((await be.getFamily()).children.map((c) => c.name)).toEqual(['Léo']);

    await be.resetChildPassword(leo.id, 'nouveau1');
    await be.logout();

    // L'enfant se connecte, voit son parent, ne peut pas supprimer son compte.
    await be.login('leo', 'nouveau1');
    expect((await be.getFamily()).parent?.name).toBe('Maman');
    await expect(be.deleteAccount('nouveau1')).rejects.toThrow('suivi par un parent');
    await expect(be.createChild({ name: 'X', username: 'xxx', password: 'secret1', avatar: '🦊', ageGroup: 'enfant' })).rejects.toThrow(
      'adulte',
    );
    await be.logout();

    // Un ado existant est relié avec son mot de passe.
    await be.register({ ...adult, name: 'Jade', username: 'jade', ageGroup: 'ado' });
    await be.logout();
    await be.login('maman', 'secret123');
    await expect(be.linkChild({ username: 'jade', password: 'faux' })).rejects.toThrow('incorrect');
    await be.linkChild({ username: 'jade', password: 'secret123' });
    expect((await be.getFamily()).children).toHaveLength(2);

    await expect(be.deleteChild(leo.id, 'faux')).rejects.toThrow('Mot de passe incorrect');
    await be.deleteChild(leo.id, 'secret123');
    expect((await be.getFamily()).children.map((c) => c.name)).toEqual(['Jade']);
  });

  it('un inconnu ne peut pas agir sur l’enfant d’un autre', async () => {
    const be = createLocalBackend();
    await be.register(adult);
    const leo = await be.createChild({ name: 'Léo', username: 'leo', password: 'leo123', avatar: '🦊', ageGroup: 'enfant' });
    await be.logout();
    await be.register({ ...adult, name: 'Inconnu', username: 'inconnu' });
    await expect(be.resetChildPassword(leo.id, 'hacked1')).rejects.toThrow('famille');
    await expect(be.unlinkChild(leo.id)).rejects.toThrow('famille');
  });

  it('la session est restaurée au redémarrage', async () => {
    await createLocalBackend().register(adult);
    const restored = await createLocalBackend().restoreSession();
    expect(restored?.username).toBe('maman');
  });
});
