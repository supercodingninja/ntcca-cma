// Copyright © 2026 NTCCA Music App™ — All Rights Reserved.
// Gifted to New Testament Christian Churches of America, INC.
// by Reverend Frederick D. Thomas, Jr., NTCC Graham, WA
// | Class of 2011, Commissioned Change Your World
// Unauthorized use is strictly prohibited.

import React, { useState, useEffect } from 'react';
import { FileMusic, AlertTriangle, Info, Download, Music, FileText } from 'lucide-react';
import { parseSibFile, SibParseResult } from '../lib/sib/parser';
import type { ScorePartwise } from '../lib/musicxml/types';
import '../styles/SibViewer.css';

interface SibViewerProps {
  file?: File;
  fileUrl?: string;
  fileName?: string;
  onParseSuccess?: (score: ScorePartwise) => void;
}

const SibViewer: React.FC<SibViewerProps> = ({ file, fileUrl, fileName, onParseSuccess }) => {
  const [result, setResult] = useState<SibParseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function parse() {
      setLoading(true);
      let targetFile: File | ArrayBuffer | null = file || null;

      // If no File provided but URL is given, fetch it
      if (!targetFile && fileUrl) {
        try {
          const response = await fetch(fileUrl);
          const blob = await response.blob();
          targetFile = new File([blob], fileName || 'score.sib', { type: 'application/octet-stream' });
        } catch (err) {
          if (!cancelled) {
            setResult({
              success: false,
              extractedStrings: [],
              warnings: ['Failed to fetch file from server'],
              error: 'Network error loading .sib file',
            });
            setLoading(false);
          }
          return;
        }
      }

      if (!targetFile) {
        if (!cancelled) {
          setResult({
            success: false,
            extractedStrings: [],
            warnings: [],
            error: 'No file or URL provided',
          });
          setLoading(false);
        }
        return;
      }

      const parseResult = await parseSibFile(targetFile);
      if (!cancelled) {
        setResult(parseResult);
        setLoading(false);
        if (parseResult.success && parseResult.score && onParseSuccess) {
          onParseSuccess(parseResult.score);
        }
      }
    }

    parse();
    return () => { cancelled = true; };
  }, [file, fileUrl, fileName, onParseSuccess]);

  const displayName = fileName || file?.name || 'Sibelius Score';

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="sib-viewer sib-viewer--loading">
        <div className="sib-viewer-spinner" />
        <p className="sib-viewer-loading-text">Reading Sibelius file...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="sib-viewer sib-viewer--error">
        <AlertTriangle size={32} />
        <p>Failed to initialize .sib reader</p>
      </div>
    );
  }

  const noteCount = result.score?.parts[0]?.measures.reduce((sum, m) => sum + m.notes.length, 0) || 0;
  const hasNotes = noteCount > 0;

  return (
    <div className="sib-viewer" role="region" aria-label="Sibelius file viewer">
      <div className="sib-viewer-header">
        <div className="sib-viewer-icon">
          <FileMusic size={28} />
        </div>
        <div className="sib-viewer-meta">
          <h3 className="sib-viewer-filename">{displayName}</h3>
          {result.versionInfo && (
            <span className="sib-viewer-version">{result.versionInfo.versionName}</span>
          )}
        </div>
        <button
          className="sib-viewer-download"
          onClick={handleDownload}
          aria-label="Download original .sib file"
        >
          <Download size={18} />
        </button>
      </div>

      <div className={`sib-viewer-banner ${result.success ? 'sib-viewer-banner--success' : 'sib-viewer-banner--warning'}`}>
        {result.success ? (
          <>
            <Music size={18} />
            <span>
              {hasNotes 
                ? `Found ${noteCount} note previews + ${result.extractedStrings.length} text strings`
                : `Metadata extracted from ${result.extractedStrings.length} strings`}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle size={18} />
            <span>{result.error || 'Unable to parse .sib file'}</span>
          </>
        )}
      </div>

      {result.metadata && (
        <div className="sib-viewer-metadata">
          {result.metadata.title && (
            <div className="sib-viewer-field">
              <span className="sib-viewer-label">Title</span>
              <span className="sib-viewer-value">{result.metadata.title}</span>
            </div>
          )}
          {result.metadata.composer && (
            <div className="sib-viewer-field">
              <span className="sib-viewer-label">Composer</span>
              <span className="sib-viewer-value">{result.metadata.composer}</span>
            </div>
          )}
          {result.metadata.copyright && (
            <div className="sib-viewer-field">
              <span className="sib-viewer-label">Copyright</span>
              <span className="sib-viewer-value">{result.metadata.copyright}</span>
            </div>
          )}
        </div>
      )}

      {hasNotes && (
        <div className="sib-viewer-notes">
          <div className="sib-viewer-notes-title">Note Preview</div>
          <div className="sib-viewer-notes-grid">
            {result.score?.parts[0]?.measures.flatMap(m => m.notes).slice(0, 48).map((note, i) => {
              const acc = note.pitch?.alter === 1 ? '♯' : note.pitch?.alter === -1 ? '♭' : '';
              return (
                <div key={i} className="sib-viewer-note-chip">
                  {note.pitch?.step}{acc}
                  <div className="sib-viewer-note-octave">{note.pitch?.octave}</div>
                </div>
              );
            })}
            {noteCount > 48 && (
              <div className="sib-viewer-note-more">+{noteCount - 48} more</div>
            )}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="sib-viewer-warnings">
          {result.warnings.map((warning, i) => (
            <div key={i} className="sib-viewer-warning">
              <Info size={14} />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {result.extractedStrings.length > 0 && (
        <div className="sib-viewer-strings">
          <button
            className="sib-viewer-strings-toggle"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <FileText size={14} />
            {expanded ? 'Hide' : 'Show'} extracted text ({result.extractedStrings.length} strings)
          </button>
          {expanded && (
            <div className="sib-viewer-strings-list">
              {result.extractedStrings.slice(0, 50).map((str, i) => (
                <code key={i} className="sib-viewer-string-item">{str}</code>
              ))}
              {result.extractedStrings.length > 50 && (
                <span className="sib-viewer-strings-more">
                  ... and {result.extractedStrings.length - 50} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="sib-viewer-tip">
        <Info size={14} />
        <span>
          For full sheet music with part selection, export this file as MusicXML from Sibelius
          (File → Export → MusicXML) and upload the .musicxml file.
        </span>
      </div>
    </div>
  );
};

export default SibViewer;
