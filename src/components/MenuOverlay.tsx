// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The "Every Section" glass overlay menu — the grid of
// tiles that lets users jump to any section they have permission to see.
// Explanation: This menu sits at z-index 250 (above all content, below
// modals and orbs). It is OPAQUE — the background behind it is dimmed with
// a dark overlay so the user focuses on the menu. The grid scrolls internally
// but NEVER bleeds scroll to the body (handled by CSS overscroll-behavior).
// Each tile shows an icon, label, and a gold ring when that section is active.
// The Back/✕/Close/Escape pattern is always available.
// In Other Words: The church directory board — every ministry room listed,
// you tap the one you want, and the door opens.
// ==========================================================================

import { useEffect, useRef } from 'react';
import { type MenuTile } from '../App';

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------
interface MenuOverlayProps {
  open: boolean;
  onClose: () => void;
  tiles: MenuTile[];
  activeSection: string;
  onSelect: (sectionId: string) => void;
  onLogout: () => void;
  churchName?: string;
}

// --------------------------------------------------------------------------
// Menu overlay
// --------------------------------------------------------------------------
export default function MenuOverlay({
  open,
  onClose,
  tiles,
  activeSection,
  onSelect,
  onLogout,
  churchName,
}: MenuOverlayProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // ------------------------------------------------------------------------
  // Focus trap — when menu opens, focus the first tile for keyboard nav
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (open && gridRef.current) {
      const firstTile = gridRef.current.querySelector<HTMLButtonElement>('.menu-tile');
      firstTile?.focus();
    }
  }, [open]);

  // ------------------------------------------------------------------------
  // Click outside to close
  // ------------------------------------------------------------------------
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // ------------------------------------------------------------------------
  // Keyboard navigation inside the grid
  // ------------------------------------------------------------------------
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const tiles = gridRef.current?.querySelectorAll<HTMLButtonElement>('.menu-tile');
    if (!tiles) return;

    const cols = getComputedStyle(gridRef.current!).gridTemplateColumns.split(' ').length;
    let nextIndex = index;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = Math.min(index + 1, tiles.length - 1);
        break;
      case 'ArrowLeft':
        nextIndex = Math.max(index - 1, 0);
        break;
      case 'ArrowDown':
        nextIndex = Math.min(index + cols, tiles.length - 1);
        break;
      case 'ArrowUp':
        nextIndex = Math.max(index - cols, 0);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tiles.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    tiles[nextIndex]?.focus();
  };

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------
  return (
    <div
      className={`menu-overlay ${open ? 'open' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      aria-hidden={!open}
    >
      {/* Header bar inside the overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--glass-bg-solid)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⛪</span>
          <span
            style={{
              fontWeight: 600,
              color: 'var(--ntcc-gold)',
              fontSize: '0.9375rem',
            }}
          >
            {churchName ?? 'NTCC Music App'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Logout button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onLogout}
            aria-label="Sign out"
          >
            🚪 Sign Out
          </button>

          {/* Close button */}
          <button
            className="btn btn-sm"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: 'transparent',
              color: 'var(--ntcc-text)',
              border: '1px solid var(--glass-border)',
              width: '36px',
              height: '36px',
              padding: 0,
              borderRadius: '50%',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tile grid */}
      <div
        ref={gridRef}
        className="menu-grid"
        role="grid"
        aria-label="App sections"
        style={{ marginTop: '3.5rem' }}
      >
        {tiles.map((tile, index) => (
          <button
            key={tile.id}
            className={`menu-tile ${activeSection === tile.section ? 'active' : ''}`}
            onClick={() => onSelect(tile.section)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            role="gridcell"
            tabIndex={0}
            aria-label={tile.label}
            aria-current={activeSection === tile.section ? 'true' : undefined}
          >
            <span className="tile-icon">{tile.icon}</span>
            <span className="tile-label">{tile.label}</span>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--ntcc-text-dim)',
        }}
      >
        Press Escape or tap outside to close · Arrow keys navigate
      </div>
    </div>
  );
}
