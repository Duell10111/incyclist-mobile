module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['./__tests__/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '__tests__/jest.setup.ts'],
  transformIgnorePatterns: [
    // RN preset default, plus ESM-only packages pulled in by incyclist-services
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|uuid|@garmin/fitsdk)/)',
  ],
  moduleNameMapper: {
    '^react-native-device-info$': '<rootDir>/node_modules/react-native-device-info/jest/react-native-device-info-mock.js',
    '^react-native-linear-gradient$': '<rootDir>/__mocks__/react-native-linear-gradient.tsx',
    'react-native-maps': '<rootDir>/__mocks__/react-native-maps.tsx',
    '^@maplibre/maplibre-react-native$': '<rootDir>/__mocks__/maplibre-react-native.tsx',
    '\\.svg$': '<rootDir>/__mocks__/svgMock.tsx',
    'react-native-safe-area-context': '<rootDir>/__mocks__/react-native-safe-area-context.ts',
    'react-native-inappbrowser-reborn': '<rootDir>/__mocks__/react-native-inappbrowser-reborn.ts',
    '@react-navigation/native': '<rootDir>/src/__mocks__/@react-navigation/native.ts', // Added for ESM module support
    // local Expo module (native, iOS only) - its index imports 'expo', which is ESM-only
    'modules/incyclist-accessory$': '<rootDir>/__mocks__/incyclist-accessory.ts',
  },
};