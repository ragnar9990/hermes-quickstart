import React from 'react';
import { WizardProvider, useWizard } from './store.jsx';
import Welcome from './screens/Welcome.jsx';
import WSL2Setup from './screens/WSL2Setup.jsx';
import Provider from './screens/Provider.jsx';
import ApiKey from './screens/ApiKey.jsx';
import Model from './screens/Model.jsx';
import Sandbox from './screens/Sandbox.jsx';
import Platforms from './screens/Platforms.jsx';
import Review from './screens/Review.jsx';
import Install from './screens/Install.jsx';

const SCREENS = {
  welcome: Welcome,
  wsl: WSL2Setup,
  provider: Provider,
  apikey: ApiKey,
  model: Model,
  sandbox: Sandbox,
  platforms: Platforms,
  review: Review,
  install: Install,
};

function Shell() {
  const { screen, SCREENS: order, state } = useWizard();
  const Current = SCREENS[screen] || Welcome;

  const visible = order.filter((s) => !(s === 'wsl' && state.os && state.os.platform !== 'win32'));
  const idx = visible.indexOf(screen);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo">H</span>
          <div>
            <h1>Hermes Quickstart</h1>
            <p className="sub">Setup wizard for Hermes Agent</p>
          </div>
        </div>
        <div className="progress">
          {visible.map((s, i) => (
            <span key={s} className={`dot ${i <= idx ? 'on' : ''}`} />
          ))}
        </div>
      </header>
      <main className="app-main">
        <Current />
      </main>
      <footer className="app-footer">
        <small>Not affiliated with Nous Research. Hermes Agent is MIT-licensed.</small>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WizardProvider>
      <Shell />
    </WizardProvider>
  );
}
