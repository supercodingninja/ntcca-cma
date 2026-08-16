// ==========================================================================
// This Area Of Code Is: The NTCCA Church Registry (subdomain universe).
// Explanation: praises.team is the organization door (NTCCA — members
// chosen across the organization for conference & special events, per
// myntcc.org). Every church gets city.praises.team: graham.praises.team,
// guam.praises.team, 29.praises.team (Twentynine Palms), and the three
// seminaries — Philippines, Arizona, and Graham WA — where students
// practice. Each entry carries the church's real social links (from the
// official YouTube "Links" panels and myntcc.org) so every subdomain shows
// ITS church's online presence. The registry is data, not code — adding
// church #101 is one line.
// In Other Words: One sanctuary app, every church's name above its own
// door, and nobody collides with anybody.
// ==========================================================================

export interface ChurchSocial {
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

export interface ChurchEntry {
  /** subdomain code: graham.praises.team → "graham" */
  code: string;
  name: string;
  kind: 'org' | 'church' | 'seminary';
  location: string;
  social: ChurchSocial;
}

// The organization door — praises.team / www.praises.team / praises.team/login
export const ORG: ChurchEntry = {
  code: 'ntcca',
  name: 'NTCCA — New Testament Christian Churches of America, Inc.',
  kind: 'org',
  location: 'United States',
  social: {
    website: 'https://myntcc.org',
    facebook: 'https://www.facebook.com/New-Testament-Christian-Churches-of-America',
    twitter: 'https://twitter.com/NTCC_of_America',
    youtube: 'https://www.youtube.com/@NTCCofAmericaLive',
  },
};

export const CHURCH_REGISTRY: ChurchEntry[] = [
  ORG,
  {
    code: 'graham',
    name: 'NTCC Graham, WA',
    kind: 'church',
    location: 'Graham, Washington',
    social: {
      website: 'https://myntcc.org/grahamwa',
      facebook: 'https://fb.me/grahamntcc',
      instagram: 'https://instagram.com/grahamntcc',
      twitter: 'https://twitter.com/GRAHAMNTCCNTCS',
      youtube: 'https://www.youtube.com/@ntccgrahamwa5506',
    },
  },
  // The three seminaries — students practice with the full toolset.
  {
    code: 'seminary-ph',
    name: 'NTCC Seminary — Philippines',
    kind: 'seminary',
    location: 'Angeles City, Philippines',
    social: { website: 'https://myntcc.org' },
  },
  {
    code: 'seminary-az',
    name: 'NTCC Seminary — Arizona',
    kind: 'seminary',
    location: 'Arizona',
    social: { website: 'https://myntcc.org' },
  },
  {
    code: 'seminary-graham',
    name: 'NTCC Seminary — Graham, WA',
    kind: 'seminary',
    location: 'Graham, Washington',
    social: { website: 'https://myntcc.org/grahamwa' },
  },
  // Sister churches spotted on the official NTCC Locator (myntcc.org map).
  { code: 'guam', name: 'NTCC Guam', kind: 'church', location: 'Guam', social: { website: 'https://myntcc.org' } },
  { code: '29', name: 'NTCC Twentynine Palms', kind: 'church', location: 'Twentynine Palms, California', social: { website: 'https://myntcc.org' } },
  { code: 'spokane', name: 'NTCC Spokane, WA', kind: 'church', location: 'Spokane, Washington', social: { website: 'https://myntcc.org' } },
  { code: 'watertown', name: 'NTCC Watertown, NY', kind: 'church', location: 'Watertown, New York', social: { website: 'https://myntcc.org' } },
  { code: 'miami', name: 'NTCC Miami, FL', kind: 'church', location: 'Miami, Florida', social: { website: 'https://myntcc.org' } },
  { code: 'corpuschristi', name: 'NTCC Corpus Christi, TX', kind: 'church', location: 'Corpus Christi, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'puertorico', name: 'NTCC Puerto Rico', kind: 'church', location: 'Puerto Rico', social: { website: 'https://myntcc.org' } },
  { code: 'panama', name: 'NTCC Panama', kind: 'church', location: 'Panama', social: { website: 'https://myntcc.org' } },
  { code: 'vilseck', name: 'NTCC Vilseck, Germany', kind: 'church', location: 'Vilseck, Germany', social: { website: 'https://myntcc.org' } },
  { code: 'angeles', name: 'NTCC Angeles City', kind: 'church', location: 'Angeles City, Philippines', social: { website: 'https://myntcc.org' } },
  { code: 'cagayan', name: 'NTCC Cagayan de Oro', kind: 'church', location: 'Cagayan de Oro, Philippines', social: { website: 'https://myntcc.org' } },
];

export function findChurch(code: string): ChurchEntry | undefined {
  return CHURCH_REGISTRY.find((c) => c.code === code);
}

/** The URL of a church's front door. */
export function churchUrl(code: string): string {
  return code === 'ntcca' ? 'https://praises.team/' : `https://${code}.praises.team/`;
}
