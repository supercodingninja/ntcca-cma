// ==========================================================================
// This Area Of Code Is: Stage Lights — the UNIVERSAL light controller.
// Explanation: One board for every light the church will ever buy. The
// driver architecture (src/lib/lights.ts) speaks WLED and Philips Hue
// today; DMX/Art-Net bridges, Govee, LIFX and whatever ships next year
// plug in as new drivers without touching this page. Register each light
// once by its WiFi address, then fire service scenes live from the phone —
// or let it follow the song sections automatically.
// In Other Words: Buy any light, any brand, any year — the app drives it.
// ==========================================================================
import { useState } from 'react';
import {
  loadLights, saveLights, fireScene, followEnabled, setFollowEnabled,
  testLight, SCENES, type LightDevice, type LightKind,
} from '../lib/lights';

export default function LightingSection() {
  const [lights, setLights] = useState<LightDevice[]>(() => loadLights());
  const [status, setStatus] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [kind, setKind] = useState<LightKind>('wled');
  const [hueUser, setHueUser] = useState('');
  const [follow, setFollow] = useState(() => followEnabled());

  const persist = (next: LightDevice[]) => { setLights(next); saveLights(next); };

  const addLight = () => {
    if (!name.trim() || !address.trim()) { setStatus('Name and WiFi address are both required.'); return; }
    persist([...lights, {
      id: `light-${Date.now()}`,
      name: name.trim(),
      kind,
      address: address.trim().replace(/^https?:\/\//, ''),
      hueUser: kind === 'hue' ? hueUser.trim() : undefined,
      hueGroup: '0',
    }]);
    setName(''); setAddress(''); setHueUser('');
    setStatus('Light registered. Tap its name to test the connection.');
  };

  const fire = async (key: keyof typeof SCENES) => {
    setStatus('⏳ Firing…');
    setStatus(await fireScene(key));
  };

  const toggleFollow = () => {
    const next = !follow;
    setFollow(next);
    setFollowEnabled(next);
    setStatus(next
      ? '💡 Following the song — scenes now fire as sections change.'
      : 'Manual mode — scenes only fire when you tap them.');
  };

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <h2 className="text-accent font-semibold mb-1">💡 Stage Lights — Universal Controller</h2>
        <p className="text-muted text-sm">
          One board for every light: WLED stage strips, Philips Hue, and every
          future brand — new lights plug in as drivers. Theater skits, altar
          calls, celebrations: fire the moment from your phone.
        </p>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">🎭 Scene Board</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(SCENES) as (keyof typeof SCENES)[]).map((key) => {
            const s = SCENES[key];
            return (
              <button key={key} className="glass-btn" onClick={() => void fire(key)}
                      style={{ borderLeft: `4px solid rgb(${s.color.join(',')})` }}>
                {s.label}
              </button>
            );
          })}
        </div>
        <button className={`glass-btn mt-3 ${follow ? 'primary' : ''}`} onClick={toggleFollow}
                aria-pressed={follow}>
          {follow ? '🎵 Following the song — ON' : '🎵 Follow the song — OFF'}
        </button>
        {status && <p className="text-sm mt-3" role="status">{status}</p>}
      </div>

      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">🔌 Registered Lights ({lights.length})</h3>
        {lights.length === 0 && (
          <p className="text-muted text-sm">No lights yet. Add your first one below — a WLED controller is the $25 way to start.</p>
        )}
        <ul className="space-y-2">
          {lights.map((d) => (
            <li key={d.id} className="glass-card p-3 flex items-center gap-3 flex-wrap">
              <button className="font-semibold flex-1 text-left" onClick={() => void testLight(d).then(setStatus)}
                      title="Tap to test connection">
                {d.kind === 'wled' ? '🌈' : '💡'} {d.name}
              </button>
              <span className="text-muted text-xs">{d.kind} · {d.address}</span>
              <button className="glass-btn text-xs" onClick={() => persist(lights.filter((l) => l.id !== d.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        <div className="grid gap-3 mt-4 sm:grid-cols-2">
          <input className="auth-input !w-full" placeholder="Light name (e.g. Stage Left)"
                 value={name} onChange={(e) => setName(e.target.value)} aria-label="Light name" />
          <input className="auth-input !w-full" placeholder="WiFi address (e.g. 192.168.1.50)"
                 value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Light WiFi address"
                 inputMode="decimal" />
          <select className="auth-input !w-full" value={kind} onChange={(e) => setKind(e.target.value as LightKind)}
                  aria-label="Light type">
            <option value="wled">WLED controller (stage LED — recommended)</option>
            <option value="hue">Philips Hue bridge (consumer bulbs)</option>
          </select>
          {kind === 'hue' && (
            <input className="auth-input !w-full" placeholder="Hue bridge user key"
                   value={hueUser} onChange={(e) => setHueUser(e.target.value)} aria-label="Hue user key" />
          )}
        </div>
        <button className="glass-btn primary mt-3" onClick={addLight}>Register light</button>

        <p className="text-muted text-xs mt-4">
          Shopping list for theater production: WLED-compatible controllers
          (Athom, AESIR, or any ESP32 board flashed with WLED — free firmware)
          + LED tape or stage pars. All talk to this app over church WiFi —
          no cloud, no subscription. DMX rigs join later through a WiFi bridge driver.
        </p>
      </div>
    </div>
  );
}
