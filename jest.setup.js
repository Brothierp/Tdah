/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Implémentation réelle (Node) des fonctions de expo-crypto utilisées par l'app.
jest.mock('expo-crypto', () => {
  const crypto = require('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algo, data) => crypto.createHash('sha256').update(data).digest('hex'),
    getRandomBytes: (n) => new Uint8Array(crypto.randomBytes(n)),
    randomUUID: () => crypto.randomUUID(),
  };
});
