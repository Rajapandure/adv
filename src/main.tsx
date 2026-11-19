import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { DataProvider } from './app/DataProvider';
import { DexieRepository, openAdvocateDb } from './data/web/DexieRepository';
import './index.css';

// Local profile creation arrives in Stage 9; until then everything lives in one default profile.
const PROFILE_ID = 'default-profile';
const root = createRoot(document.getElementById('root')!);

async function boot() {
  try {
    const db = openAdvocateDb();
    await db.open();
    // Ask the browser not to evict our data under storage pressure (not guaranteed; Stage 9 adds visible warnings).
    void navigator.storage?.persist?.();
    root.render(<StrictMode><BrowserRouter><DataProvider repo={new DexieRepository(db, PROFILE_ID)}><App /></DataProvider></BrowserRouter></StrictMode>);
  } catch (e) {
    root.render(<p role="alert" style={{ padding: 24 }}>Could not open local storage: {(e as Error).message}. Private/incognito windows may block it.</p>);
  }
}
void boot();
