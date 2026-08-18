// Copyright © 2026 Reverend Frederick D. Thomas, Jr. — All Rights Reserved.
// Unauthorized use is strictly prohibited.

// ==========================================================================
// This Area Of Code Is: The NTCCA Church Registry (subdomain universe).
// Explanation: praises.team is the organization door. Every church gets
// city.praises.team. Each entry carries real social links where known.
// Adding church #101 is one line.
// In Other Words: One sanctuary app, every church's name above its own door.
// ==========================================================================

export interface ChurchSocial {
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

export interface ChurchEntry {
  code: string;
  name: string;
  kind: 'org' | 'church' | 'seminary' | 'campground';
  location: string;
  social: ChurchSocial;
}

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
  { code: '29', name: 'NTCC 29 Palms, CA', kind: 'church', location: 'Twentynine Palms, California', social: { website: 'https://myntcc.org' } },
  { code: 'albuquerque', name: 'NTCC Albuquerque, NM', kind: 'church', location: 'Albuquerque, New Mexico', social: { website: 'https://myntcc.org' } },
  { code: 'amarillo', name: 'NTCC Amarillo, TX', kind: 'church', location: 'Amarillo, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'anchorage', name: 'NTCC Anchorage, AK', kind: 'church', location: 'Anchorage, Alaska', social: { website: 'https://myntcc.org' } },
  { code: 'angeles', name: 'NTCC Angeles City', kind: 'church', location: 'Angeles City, Philippines', social: { website: 'https://myntcc.org' } },
  { code: 'august', name: 'NTCC August, GA', kind: 'church', location: 'Augusta, Georgia', social: { website: 'https://myntcc.org' } },
  { code: 'austin', name: 'NTCC Austin, TX', kind: 'church', location: 'Austin, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'auxvasse', name: 'NTCC Auxvasse, MO', kind: 'church', location: 'Auxvasse, Missouri', social: { website: 'https://myntcc.org' } },
  { code: 'bakersfield', name: 'NTCC Bakersfield, CA', kind: 'church', location: 'Bakersfield, California', social: { website: 'https://myntcc.org' } },
  { code: 'baltimore', name: 'NTCC Baltimore, MD', kind: 'church', location: 'Baltimore, Maryland', social: { website: 'https://myntcc.org' } },
  { code: 'belleville', name: 'NTCC Belleville, IL', kind: 'church', location: 'Belleville, Illinois', social: { website: 'https://myntcc.org' } },
  { code: 'berkeley', name: 'NTCC Berkeley, MO', kind: 'church', location: 'Berkeley, Missouri', social: { website: 'https://myntcc.org' } },
  { code: 'bremerton', name: 'NTCC Bremerton, WA', kind: 'church', location: 'Bremerton, Washington', social: { website: 'https://myntcc.org' } },
  { code: 'brooklyn', name: 'NTCC Brooklyn, NY', kind: 'church', location: 'Brooklyn, New York', social: { website: 'https://myntcc.org' } },
  { code: 'cagayan', name: 'NTCC Cagayan de Oro', kind: 'church', location: 'Cagayan de Oro, Philippines', social: { website: 'https://myntcc.org' } },
  { code: 'camp-humphreys', name: 'NTCC Camp Humphreys, South Korea', kind: 'church', location: 'Camp Humphreys, South Korea', social: { website: 'https://myntcc.org' } },
  { code: 'campground', name: 'NTCC Of America National Campground', kind: 'campground', location: 'United States', social: { website: 'https://myntcc.org' } },
  { code: 'central-florida', name: 'NTCC Central Florida', kind: 'church', location: 'Central Florida', social: { website: 'https://myntcc.org' } },
  { code: 'charleston', name: 'NTCC Charleston, WV', kind: 'church', location: 'Charleston, West Virginia', social: { website: 'https://myntcc.org' } },
  { code: 'charlotte', name: 'NTCC Charlotte, NC', kind: 'church', location: 'Charlotte, North Carolina', social: { website: 'https://myntcc.org' } },
  { code: 'cheyenne', name: 'NTCC Cheyenne, WY', kind: 'church', location: 'Cheyenne, Wyoming', social: { website: 'https://myntcc.org' } },
  { code: 'chicago-heights', name: 'NTCC Chicago Heights, IL', kind: 'church', location: 'Chicago Heights, Illinois', social: { website: 'https://myntcc.org' } },
  { code: 'colorado-springs', name: 'NTCC Colorado Springs, CO', kind: 'church', location: 'Colorado Springs, Colorado', social: { website: 'https://myntcc.org' } },
  { code: 'columbia', name: 'NTCC Columbia, SC', kind: 'church', location: 'Columbia, South Carolina', social: { website: 'https://myntcc.org' } },
  { code: 'columbus', name: 'NTCC Columbus, OH', kind: 'church', location: 'Columbus, Ohio', social: { website: 'https://myntcc.org' } },
  { code: 'corpus-christi', name: 'NTCC Corpus Christi, TX', kind: 'church', location: 'Corpus Christi, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'dallas', name: 'NTCC Dallas, TX', kind: 'church', location: 'Dallas, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'dayton', name: 'NTCC Dayton, OH', kind: 'church', location: 'Dayton, Ohio', social: { website: 'https://myntcc.org' } },
  { code: 'del-city', name: 'NTCC Del City, OK', kind: 'church', location: 'Del City, Oklahoma', social: { website: 'https://myntcc.org' } },
  { code: 'denver', name: 'NTCC Denver, CO', kind: 'church', location: 'Denver, Colorado', social: { website: 'https://myntcc.org' } },
  { code: 'detroit', name: 'NTCC Detroit, MI', kind: 'church', location: 'Detroit, Michigan', social: { website: 'https://myntcc.org' } },
  { code: 'el-paso', name: 'NTCC El Paso, TX', kind: 'church', location: 'El Paso, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'fairborn', name: 'NTCC Fairborn, OH', kind: 'church', location: 'Fairborn, Ohio', social: { website: 'https://myntcc.org' } },
  { code: 'fayetteville', name: 'NTCC Fayetteville, NC', kind: 'church', location: 'Fayetteville, North Carolina', social: { website: 'https://myntcc.org' } },
  { code: 'fresno', name: 'NTCC Fresno, CA', kind: 'church', location: 'Fresno, California', social: { website: 'https://myntcc.org' } },
  { code: 'ft-worth', name: 'NTCC Ft Worth, TX', kind: 'church', location: 'Fort Worth, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'glendale', name: 'NTCC Glendale, AZ', kind: 'church', location: 'Glendale, Arizona', social: { website: 'https://myntcc.org' } },
  { code: 'graham', name: 'NTCC Graham, WA', kind: 'church', location: 'Graham, Washington', social: { website: 'https://myntcc.org/grahamwa', facebook: 'https://fb.me/grahamntcc', instagram: 'https://instagram.com/grahamntcc', twitter: 'https://twitter.com/GRAHAMNTCCNTCS', youtube: 'https://www.youtube.com/@ntccgrahamwa5506' } },
  { code: 'guam', name: 'NTCC Guam', kind: 'church', location: 'Guam', social: { website: 'https://myntcc.org' } },
  { code: 'hannibal', name: 'NTCC Hannibal, MO', kind: 'church', location: 'Hannibal, Missouri', social: { website: 'https://myntcc.org' } },
  { code: 'hawaii', name: 'NTCC Hawaii', kind: 'church', location: 'Hawaii', social: { website: 'https://myntcc.org' } },
  { code: 'hinesville', name: 'NTCC Hinesville, GA', kind: 'church', location: 'Hinesville, Georgia', social: { website: 'https://myntcc.org' } },
  { code: 'hopkinsville', name: 'NTCC Hopkinsville, KY', kind: 'church', location: 'Hopkinsville, Kentucky', social: { website: 'https://myntcc.org' } },
  { code: 'indianapolis', name: 'NTCC Indianapolis, IN', kind: 'church', location: 'Indianapolis, Indiana', social: { website: 'https://myntcc.org' } },
  { code: 'irving', name: 'NTCC Irving, TX', kind: 'church', location: 'Irving, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'jacksonville-ar', name: 'NTCC Jacksonville, AR', kind: 'church', location: 'Jacksonville, Arkansas', social: { website: 'https://myntcc.org' } },
  { code: 'jacksonville-nc', name: 'NTCC Jacksonville, NC', kind: 'church', location: 'Jacksonville, North Carolina', social: { website: 'https://myntcc.org' } },
  { code: 'junction-city', name: 'NTCC Junction City, KS', kind: 'church', location: 'Junction City, Kansas', social: { website: 'https://myntcc.org' } },
  { code: 'kaneohe', name: 'NTCC Kaneohe, HI', kind: 'church', location: 'Kaneohe, Hawaii', social: { website: 'https://myntcc.org' } },
  { code: 'killeen', name: 'NTCC Killeen, TX', kind: 'church', location: 'Killeen, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'lacey', name: 'NTCC Lacey, WA', kind: 'church', location: 'Lacey, Washington', social: { website: 'https://myntcc.org' } },
  { code: 'lakeland', name: 'NTCC Lakeland, FL', kind: 'church', location: 'Lakeland, Florida', social: { website: 'https://myntcc.org' } },
  { code: 'lawton', name: 'NTCC Lawton, OK', kind: 'church', location: 'Lawton, Oklahoma', social: { website: 'https://myntcc.org' } },
  { code: 'leesville', name: 'NTCC Leesville, LA', kind: 'church', location: 'Leesville, Louisiana', social: { website: 'https://myntcc.org' } },
  { code: 'lexington', name: 'NTCC Lexington, KY', kind: 'church', location: 'Lexington, Kentucky', social: { website: 'https://myntcc.org' } },
  { code: 'los-angeles', name: 'NTCC Los Angeles, CA', kind: 'church', location: 'Los Angeles, California', social: { website: 'https://myntcc.org' } },
  { code: 'louisville', name: 'NTCC Louisville, KY', kind: 'church', location: 'Louisville, Kentucky', social: { website: 'https://myntcc.org' } },
  { code: 'macon', name: 'NTCC Macon, GA', kind: 'church', location: 'Macon, Georgia', social: { website: 'https://myntcc.org' } },
  { code: 'madison', name: 'NTCC Madison, WI', kind: 'church', location: 'Madison, Wisconsin', social: { website: 'https://myntcc.org' } },
  { code: 'marietta', name: 'NTCC Marietta, GA', kind: 'church', location: 'Marietta, Georgia', social: { website: 'https://myntcc.org' } },
  { code: 'mckees-rocks', name: 'NTCC McKees Rocks, PA', kind: 'church', location: 'McKees Rocks, Pennsylvania', social: { website: 'https://myntcc.org' } },
  { code: 'memphis', name: 'NTCC Memphis, TN', kind: 'church', location: 'Memphis, Tennessee', social: { website: 'https://myntcc.org' } },
  { code: 'mesa', name: 'NTCC Mesa, AZ', kind: 'church', location: 'Mesa, Arizona', social: { website: 'https://myntcc.org' } },
  { code: 'miami', name: 'NTCC Miami, FL', kind: 'church', location: 'Miami, Florida', social: { website: 'https://myntcc.org' } },
  { code: 'modesto', name: 'NTCC Modesto, CA', kind: 'church', location: 'Modesto, California', social: { website: 'https://myntcc.org' } },
  { code: 'nashville', name: 'NTCC Nashville, TN', kind: 'church', location: 'Nashville, Tennessee', social: { website: 'https://myntcc.org' } },
  { code: 'newport-news', name: 'NTCC Newport News, VA', kind: 'church', location: 'Newport News, Virginia', social: { website: 'https://myntcc.org' } },
  { code: 'oceanside', name: 'NTCC Oceanside, CA', kind: 'church', location: 'Oceanside, California', social: { website: 'https://myntcc.org' } },
  { code: 'okinawa', name: 'NTCC Okinawa, Japan', kind: 'church', location: 'Okinawa, Japan', social: { website: 'https://myntcc.org' } },
  { code: 'orange-park', name: 'NTCC Orange Park, FL', kind: 'church', location: 'Orange Park, Florida', social: { website: 'https://myntcc.org' } },
  { code: 'orlando', name: 'NTCC Orlando, FL', kind: 'church', location: 'Orlando, Florida', social: { website: 'https://myntcc.org' } },
  { code: 'panama', name: 'NTCC Panama', kind: 'church', location: 'Panama', social: { website: 'https://myntcc.org' } },
  { code: 'pasadena', name: 'NTCC Pasadena, TX', kind: 'church', location: 'Pasadena, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'phenix-city', name: 'NTCC Phenix City, AL', kind: 'church', location: 'Phenix City, Alabama', social: { website: 'https://myntcc.org' } },
  { code: 'portland', name: 'NTCC Portland, OR', kind: 'church', location: 'Portland, Oregon', social: { website: 'https://myntcc.org' } },
  { code: 'puertorico', name: 'NTCC Puerto Rico', kind: 'church', location: 'Puerto Rico', social: { website: 'https://myntcc.org' } },
  { code: 'redding', name: 'NTCC Redding, CA', kind: 'church', location: 'Redding, California', social: { website: 'https://myntcc.org' } },
  { code: 'renton', name: 'NTCC Renton, WA', kind: 'church', location: 'Renton, Washington', social: { website: 'https://myntcc.org' } },
  { code: 'richmond', name: 'NTCC Richmond, VA', kind: 'church', location: 'Richmond, Virginia', social: { website: 'https://myntcc.org' } },
  { code: 'riverdale', name: 'NTCC Riverdale, GA', kind: 'church', location: 'Riverdale, Georgia', social: { website: 'https://myntcc.org' } },
  { code: 'san-antonio', name: 'NTCC San Antonio, TX', kind: 'church', location: 'San Antonio, Texas', social: { website: 'https://myntcc.org' } },
  { code: 'secaucus', name: 'NTCC Secaucus, NJ', kind: 'church', location: 'Secaucus, New Jersey', social: { website: 'https://myntcc.org' } },
  { code: 'seminary-graham', name: 'NTCC Seminary — Graham, WA', kind: 'seminary', location: 'Graham, Washington', social: { website: 'https://myntcc.org/grahamwa' } },
  { code: 'seminary-phoenix', name: 'NTCC Seminary — Phoenix, AZ', kind: 'seminary', location: 'Phoenix, Arizona', social: { website: 'https://myntcc.org' } },
  { code: 'shreveport', name: 'NTCC Shreveport, LA & Barksdale AFB', kind: 'church', location: 'Shreveport, Louisiana', social: { website: 'https://myntcc.org' } },
  { code: 'sierra-vista', name: 'NTCC Sierra Vista, AZ', kind: 'church', location: 'Sierra Vista, Arizona', social: { website: 'https://myntcc.org' } },
  { code: 'sioux-falls', name: 'NTCC Sioux Falls, SD', kind: 'church', location: 'Sioux Falls, South Dakota', social: { website: 'https://myntcc.org' } },
  { code: 'spokane', name: 'NTCC Spokane, WA', kind: 'church', location: 'Spokane, Washington', social: { website: 'https://myntcc.org' } },
  { code: 'springfield', name: 'NTCC Springfield, MO', kind: 'church', location: 'Springfield, Missouri', social: { website: 'https://myntcc.org' } },
  { code: 'st-louis', name: 'NTCC St Louis, MO', kind: 'church', location: 'St. Louis, Missouri', social: { website: 'https://myntcc.org' } },
  { code: 'tampa', name: 'NTCC Tampa, FL', kind: 'church', location: 'Tampa, Florida', social: { website: 'https://myntcc.org' } },
  { code: 'tillicum', name: 'NTCC Tillicum, WA', kind: 'church', location: 'Tillicum, Washington', social: { website: 'https://myntcc.org' } },
  { code: 'tucson', name: 'NTCC Tucson, AZ', kind: 'church', location: 'Tucson, Arizona', social: { website: 'https://myntcc.org' } },
  { code: 'vilseck', name: 'NTCC Vilseck, Germany', kind: 'church', location: 'Vilseck, Germany', social: { website: 'https://myntcc.org' } },
  { code: 'washington-dc', name: 'NTCC Washington D.C.', kind: 'church', location: 'Washington, D.C.', social: { website: 'https://myntcc.org' } },
  { code: 'watertown', name: 'NTCC Watertown, NY', kind: 'church', location: 'Watertown, New York', social: { website: 'https://myntcc.org' } },
  { code: 'wichita', name: 'NTCC Wichita, KS', kind: 'church', location: 'Wichita, Kansas', social: { website: 'https://myntcc.org' } },
  { code: 'woodbrook', name: 'NTCC Woodbrook, WA', kind: 'church', location: 'Woodbrook, Washington', social: { website: 'https://myntcc.org' } },
];

export function findChurch(code: string): ChurchEntry | undefined {
  return CHURCH_REGISTRY.find((c) => c.code === code);
}

export function churchUrl(code: string): string {
  return code === 'ntcca' ? 'https://praises.team/' : `https://${code}.praises.team/`;
}
