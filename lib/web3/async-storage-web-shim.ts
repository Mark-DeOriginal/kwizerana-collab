/**
 * MetaMask SDK's browser bundle contains a guarded React Native-only require.
 * Browsers use localStorage and never execute this module; the shim only keeps
 * web bundlers from attempting to install or bundle React Native AsyncStorage.
 */
const unavailableInBrowser = async (): Promise<never> => {
  throw new Error("React Native AsyncStorage is unavailable in the web application.");
};

const asyncStorageWebShim = {
  getItem: unavailableInBrowser,
  setItem: unavailableInBrowser,
  removeItem: unavailableInBrowser
};

export default asyncStorageWebShim;
