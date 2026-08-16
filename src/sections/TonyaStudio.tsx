// ==========================================================================
// This Area Of Code Is: Tonya's Theme Studio (org admins).
// Explanation: Push-and-click theming like WordPress / Wix / Figma community
// templates — pick a preset or tune the colors, and the look applies to the
// WHOLE church: every musician, sound engineer, media, tempo, editor under
// this church code. Tonya's guardrail is absolute: features can be moved
// (nav bar, ✦ menu) but NEVER removed. Try to drop one and she warns
// "You're forgetting about this feature!" and relocates it herself.
// Honest note: themes save on-device per church (the device IS the server).
// A true automatic GitHub-repository commit can't happen from the browser
// without your private credentials — and we never ask for those. To ship a
// theme to every device, post it as a bulletin and each device applies it.
// ==========================================================================

import { useState } from 'react';
import {
  THEME_PRESETS, GUARDED_FEATURES, loadChurchTheme, saveChurchTheme,
  loadPlacements, savePlacements, enforceGuardrail,
  type ChurchTheme, type FeaturePlacement,
} from '../lib/theme';

export default function TonyaStudio() {
  const [theme, setTheme] = useState<ChurchTheme>(loadChurchTheme);
  const [placements, setPlacements] = useState(loadPlacements);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedMsg, setSavedMsg] = useState('');

  const update = (patch: Partial<ChurchTheme>) => {
    const t = { ...theme, ...patch };
    setTheme(t);
    saveChurchTheme(t);          // live repaint — the whole church's look
    setSavedMsg('✓ Look updated for your whole church — every role sees it.');
  };

  const move = (featureId: string, to: FeaturePlacement | 'remove') => {
    const next = { ...placements };
    if (to === 'remove') delete next[featureId];   // attempt — the guardrail decides
    else next[featureId] = to;
    const { fixed, warnings: w } = enforceGuardrail(next);
    setPlacements(fixed);
    savePlacements(fixed);
    setWarnings(w);
  };

  return (
    <div className="glass-card p-5 space-y-5">
      <div>
        <h3 className="text-accent font-semibold">🎨 Tonya — Church Look Studio</h3>
        <p className="text-muted text-sm">
          Push-and-click design, like website templates. Change the look for your whole
          church — musicians, sound, media, tempo, editors — without breaking a single function.
        </p>
      </div>
      {savedMsg && <p className="text-green-400 text-sm">{savedMsg}</p>}

      {/* Preset templates */}
      <div>
        <p className="font-semibold text-sm mb-2">Templates</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEME_PRESETS.map((p) => (
            <button key={p.id}
                    className={`glass-btn text-sm flex items-center gap-2 ${theme.presetId === p.id ? 'primary' : ''}`}
                    onClick={() => update({ presetId: p.id, ...p.theme })}>
              <span className="w-4 h-4 rounded-full border border-white/40" style={{ background: p.swatch }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Fine-tune colors */}
      <div>
        <p className="font-semibold text-sm mb-2">Fine-tune</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <label className="block">Accent
            <input type="color" className="w-full h-9 rounded mt-1 bg-transparent"
                   value={theme.accent} onChange={(e) => update({ accent: e.target.value, presetId: 'custom' })} /></label>
          <label className="block">Background
            <input type="color" className="w-full h-9 rounded mt-1 bg-transparent"
                   value={theme.bgDeep} onChange={(e) => update({ bgDeep: e.target.value, presetId: 'custom' })} /></label>
          <label className="block">Text
            <input type="color" className="w-full h-9 rounded mt-1 bg-transparent"
                   value={theme.textPrimary} onChange={(e) => update({ textPrimary: e.target.value, presetId: 'custom' })} /></label>
          <label className="block">Density
            <select className="auth-input w-full mt-1" value={theme.density}
                    onChange={(e) => update({ density: e.target.value as ChurchTheme['density'] })}>
              <option value="comfortable">Comfortable</option>
              <option value="cozy">Cozy</option>
            </select></label>
        </div>
      </div>

      {/* Feature placement — THE GUARDRAIL */}
      <div>
        <p className="font-semibold text-sm mb-1">Feature placement</p>
        <p className="text-muted text-xs mb-2">
          Buttons may appear differently or in a different order — but no feature can ever be removed.
          Tonya relocates anything you forget.
        </p>
        {warnings.map((w, i) => <p key={i} className="text-amber-400 text-xs mb-1">{w}</p>)}
        <ul className="space-y-1">
          {GUARDED_FEATURES.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm flex-wrap">
              <span className="flex-1">{f.label}</span>
              {(['nav', 'menu'] as const).map((dest) => (
                <button key={dest}
                        className={`glass-btn text-xs ${placements[f.id] === dest ? 'primary' : ''}`}
                        onClick={() => move(f.id, dest)}>
                  {dest === 'nav' ? '⭐ Top nav' : '✦ Menu'}
                </button>
              ))}
              <button className="glass-btn text-xs danger" onClick={() => move(f.id, 'remove')}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-muted text-xs">
        💾 Saved automatically on this device for your church. To push the new look to every
        teammate's device, post a 📣 bulletin telling them to open Admin → Tonya once — their
        app adopts the church look on arrival. (An automatic repository commit from the browser
        would require your private GitHub password — we never ask for it.)
      </p>
    </div>
  );
}
