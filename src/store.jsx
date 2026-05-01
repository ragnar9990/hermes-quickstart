import { createContext, useContext, useState, useCallback } from 'react';

const WizardContext = createContext(null);

const initialState = {
  os: null,
  wsl: null,
  hermes: null,
  provider: 'openrouter',
  apiKey: '',
  model: '',
  sandbox: 'local',
  platforms: {
    telegram: { enabled: false, token: '' },
    discord: { enabled: false, token: '' },
    slack: { enabled: false, token: '' },
  },
  tools: [],
};

const SCREENS = [
  'welcome',
  'wsl',
  'provider',
  'apikey',
  'model',
  'sandbox',
  'platforms',
  'review',
  'install',
];

export function WizardProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [screen, setScreen] = useState('welcome');

  const update = useCallback((patch) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const next = useCallback(() => {
    setScreen((cur) => {
      const i = SCREENS.indexOf(cur);
      let target = SCREENS[Math.min(i + 1, SCREENS.length - 1)];
      // skip wsl on non-windows
      if (target === 'wsl' && state.os && state.os.platform !== 'win32') {
        target = SCREENS[i + 2] || target;
      }
      return target;
    });
  }, [state.os]);

  const back = useCallback(() => {
    setScreen((cur) => {
      const i = SCREENS.indexOf(cur);
      let target = SCREENS[Math.max(i - 1, 0)];
      if (target === 'wsl' && state.os && state.os.platform !== 'win32') {
        target = SCREENS[Math.max(i - 2, 0)];
      }
      return target;
    });
  }, [state.os]);

  const goto = useCallback((name) => setScreen(name), []);

  return (
    <WizardContext.Provider value={{ state, update, screen, next, back, goto, SCREENS }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard outside provider');
  return ctx;
}
