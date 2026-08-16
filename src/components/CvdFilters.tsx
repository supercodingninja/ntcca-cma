// ==========================================================================
// This Area Of Code Is: The color-vision simulation matrices.
// Explanation: Eight SVG feColorMatrix filters that reshape every color on
// screen the way each type of color vision actually perceives it — so a
// deuteranope musician, for example, finally sees the app in HIS colors.
// Invisible element, zero layout cost, referenced by the CSS url(#…)
// filters. Matrices follow the Machado/Oliveira/Fernandes model.
// ==========================================================================

export default function CvdFilters() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="cvd-protanopia">
          <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" />
        </filter>
        <filter id="cvd-protanomaly">
          <feColorMatrix type="matrix" values="0.817 0.183 0 0 0  0.333 0.667 0 0 0  0 0.125 0.875 0 0  0 0 0 1 0" />
        </filter>
        <filter id="cvd-deuteranopia">
          <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
        </filter>
        <filter id="cvd-deuteranomaly">
          <feColorMatrix type="matrix" values="0.8 0.2 0 0 0  0.258 0.742 0 0 0  0 0.142 0.858 0 0  0 0 0 1 0" />
        </filter>
        <filter id="cvd-tritanopia">
          <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" />
        </filter>
        <filter id="cvd-tritanomaly">
          <feColorMatrix type="matrix" values="0.967 0.033 0 0 0  0 0.733 0.267 0 0  0 0.183 0.817 0 0  0 0 0 1 0" />
        </filter>
      </defs>
    </svg>
  );
}
