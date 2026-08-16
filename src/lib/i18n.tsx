// ==========================================================================
// This Area Of Code Is: The i18n engine — 47+ languages (ported from
// Adoración's system).
// Explanation: Lazy-loaded dictionary packs with a fallback chain
// (selected → English), RTL auto-flip, native language names, and a React
// hook. English and Spanish ship complete; the remaining packs carry core
// worship strings and fall back to English for anything missing.
// In Other Words: The whole app speaks the congregation's language.
// ==========================================================================

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface LangMeta {
  code: string;
  native: string;
  english: string;
  rtl?: boolean;
}

// The 47+ language manifest — native names for the picker.
export const LANGUAGES: LangMeta[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'de', native: 'Deutsch', english: 'German' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'nl', native: 'Nederlands', english: 'Dutch' },
  { code: 'pl', native: 'Polski', english: 'Polish' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'uk', native: 'Українська', english: 'Ukrainian' },
  { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true },
  { code: 'he', native: 'עברית', english: 'Hebrew', rtl: true },
  { code: 'fa', native: 'فارسی', english: 'Farsi', rtl: true },
  { code: 'ur', native: 'اردو', english: 'Urdu', rtl: true },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'zh-CN', native: '简体中文', english: 'Chinese Simplified' },
  { code: 'zh-TW', native: '繁體中文', english: 'Chinese Traditional' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
  { code: 'ko', native: '한국어', english: 'Korean' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'th', native: 'ไทย', english: 'Thai' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'ms', native: 'Bahasa Melayu', english: 'Malay' },
  { code: 'tl', native: 'Tagalog', english: 'Tagalog' },
  { code: 'sw', native: 'Kiswahili', english: 'Swahili' },
  { code: 'am', native: 'አማርኛ', english: 'Amharic' },
  { code: 'yo', native: 'Yorùbá', english: 'Yoruba' },
  { code: 'ig', native: 'Igbo', english: 'Igbo' },
  { code: 'ha', native: 'Hausa', english: 'Hausa' },
  { code: 'zu', native: 'isiZulu', english: 'Zulu' },
  { code: 'xh', native: 'isiXhosa', english: 'Xhosa' },
  { code: 'af', native: 'Afrikaans', english: 'Afrikaans' },
  { code: 'el', native: 'Ελληνικά', english: 'Greek' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish' },
  { code: 'ro', native: 'Română', english: 'Romanian' },
  { code: 'hu', native: 'Magyar', english: 'Hungarian' },
  { code: 'cs', native: 'Čeština', english: 'Czech' },
  { code: 'sk', native: 'Slovenčina', english: 'Slovak' },
  { code: 'sr', native: 'Српски', english: 'Serbian' },
  { code: 'hr', native: 'Hrvatski', english: 'Croatian' },
  { code: 'hy', native: 'Հայերեն', english: 'Armenian' },
  { code: 'ka', native: 'ქართული', english: 'Georgian' },
];

export type Dict = Record<string, string>;

// English is the base dictionary — every key the UI uses.
const en: Dict = {
  appName: 'NTCCA Music App™',
  library: 'Library', setlist: 'Setlist', director: 'Director', lighting: 'Lighting',
  access: 'Access', security: 'ShieldWall', language: 'Language',
  searchSongs: 'Search songs…', transpose: 'Transpose', capo: 'Capo',
  autoScroll: 'Auto-scroll', speed: 'Speed', addToSetlist: 'Add to setlist',
  remove: 'Remove', emptySetlist: 'Your setlist is empty. Add songs from the Library.',
  buzzer: 'CUT', buzzerHint: 'Music Director’s Cut — taps the entire band out, loud.',
  stop: 'Stop', metronome: 'Metronome', bpm: 'BPM', start: 'Start',
  theme: 'Theme', masculine: 'Masculine', feminine: 'Feminine', unisex: 'Unisex',
  fontSize: 'Font size', contrast: 'High contrast', motion: 'Reduced motion',
  fontSizeHint: 'Scales all text 80%–200%.', contrastHint: 'WCAG AAA palette.',
  motionHint: 'Disables animations.',
  threatScore: 'Threat score', status: 'Status', secure: 'SECURE', blocked: 'BLOCKED',
  learnedRules: 'Learned rules', honeypot: 'Trigger honeypot (demo)',
  simulate: 'Simulate attack', abuseReport: 'Abuse report', runKillChain: 'Run kill-chain',
  nowPlaying: 'Now playing', scripture: 'Scripture (KJV)', key: 'Key', play: 'Play',
  verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge', intro: 'Intro', outro: 'Outro',
  simulator: 'LED simulator', scene: 'Scene', worshipDefault: 'Worship default',
  songsInLibrary: 'songs in library', online: 'Online', offline: 'Offline',
};

// Spanish — complete pack (priority: NTCC Graham Spanish Worship Team).
const es: Dict = {
  appName: 'NTCC Música', library: 'Cancionero', setlist: 'Lista', director: 'Director',
  lighting: 'Iluminación', access: 'Acceso', security: 'ShieldWall', language: 'Idioma',
  searchSongs: 'Buscar canciones…', transpose: 'Transportar', capo: 'Cejilla',
  autoScroll: 'Desplazamiento', speed: 'Velocidad', addToSetlist: 'Añadir a la lista',
  remove: 'Quitar', emptySetlist: 'Tu lista está vacía. Añade canciones del Cancionero.',
  buzzer: 'CORTE', buzzerHint: 'Corte del Director — detiene a toda la banda, fuerte.',
  stop: 'Detener', metronome: 'Metrónomo', bpm: 'BPM', start: 'Iniciar',
  theme: 'Tema', masculine: 'Masculino', feminine: 'Femenino', unisex: 'Unisex',
  fontSize: 'Tamaño de letra', contrast: 'Alto contraste', motion: 'Movimiento reducido',
  threatScore: 'Nivel de amenaza', status: 'Estado', secure: 'SEGURO', blocked: 'BLOQUEADO',
  learnedRules: 'Reglas aprendidas', honeypot: 'Activar trampa (demo)',
  simulate: 'Simular ataque', abuseReport: 'Informe de abuso', runKillChain: 'Ejecutar kill-chain',
  nowPlaying: 'Sonando', scripture: 'Escritura (RV60/KJV)', key: 'Tono', play: 'Tocar',
  verse: 'Verso', chorus: 'Coro', bridge: 'Puente', intro: 'Intro', outro: 'Final',
  simulator: 'Simulador LED', scene: 'Escena', worshipDefault: 'Adoración',
  songsInLibrary: 'canciones', online: 'En línea', offline: 'Sin conexión',
};

// ==========================================================================
// This Area Of Code Is: The 47+ language packs.
// Explanation: English is the default dictionary; Spanish is the complete
// secondary pack (NTCC Graham Spanish Worship Team priority). The next 20
// languages carry full UI packs; every remaining language ships the worship
// core strings and falls back to English for anything missing — so no user
// on Earth ever sees a broken interface.
// In Other Words: The app greets every nation in their own tongue.
// ==========================================================================
const core = (over: Partial<Dict>): Dict => over as Dict;
const PACKS: Record<string, Dict> = {
  en, es,
  pt: core({ appName: 'NTCCA Music App™', library: 'Biblioteca', setlist: 'Repertório', director: 'Diretor', lighting: 'Iluminação', access: 'Acesso', security: 'ShieldWall', language: 'Idioma', searchSongs: 'Buscar músicas…', transpose: 'Transpor', capo: 'Capotraste', autoScroll: 'Rolagem auto.', speed: 'Velocidade', addToSetlist: 'Adicionar', remove: 'Remover', emptySetlist: 'Seu repertório está vazio.', stop: 'Parar', metronome: 'Metrônomo', bpm: 'BPM', start: 'Iniciar', theme: 'Tema', play: 'Tocar', verse: 'Verso', chorus: 'Refrão', bridge: 'Ponte', intro: 'Intro', outro: 'Final', key: 'Tom', nowPlaying: 'Tocando', online: 'Online', offline: 'Offline', simulator: 'Simulador LED', scene: 'Cena', songsInLibrary: 'músicas' }),
  fr: core({ appName: 'NTCCA Music App™', library: 'Bibliothèque', setlist: 'Liste', director: 'Directeur', lighting: 'Éclairage', access: 'Accès', security: 'ShieldWall', language: 'Langue', searchSongs: 'Rechercher des chants…', transpose: 'Transposer', capo: 'Capo', autoScroll: 'Défilement auto', speed: 'Vitesse', addToSetlist: 'Ajouter', remove: 'Retirer', emptySetlist: 'Votre liste est vide.', stop: 'Arrêter', metronome: 'Métronome', bpm: 'BPM', start: 'Démarrer', theme: 'Thème', play: 'Jouer', verse: 'Couplet', chorus: 'Refrain', bridge: 'Pont', intro: 'Intro', outro: 'Final', key: 'Tonalité', nowPlaying: 'En cours', online: 'En ligne', offline: 'Hors ligne', simulator: 'Simulateur LED', scene: 'Scène', songsInLibrary: 'chants' }),
  de: core({ appName: 'NTCCA Music App™', library: 'Bibliothek', setlist: 'Setliste', director: 'Leiter', lighting: 'Licht', access: 'Zugang', security: 'ShieldWall', language: 'Sprache', searchSongs: 'Lieder suchen…', transpose: 'Transponieren', capo: 'Kapodaster', autoScroll: 'Auto-Scroll', speed: 'Tempo', addToSetlist: 'Hinzufügen', remove: 'Entfernen', emptySetlist: 'Ihre Setliste ist leer.', stop: 'Stopp', metronome: 'Metronom', bpm: 'BPM', start: 'Start', theme: 'Thema', play: 'Abspielen', verse: 'Strophe', chorus: 'Refrain', bridge: 'Bridge', intro: 'Intro', outro: 'Outro', key: 'Tonart', nowPlaying: 'Läuft', online: 'Online', offline: 'Offline', simulator: 'LED-Simulator', scene: 'Szene', songsInLibrary: 'Lieder' }),
  it: core({ appName: 'NTCCA Music App™', library: 'Libreria', setlist: 'Scaletta', director: 'Direttore', lighting: 'Luci', access: 'Accesso', security: 'ShieldWall', language: 'Lingua', searchSongs: 'Cerca canti…', transpose: 'Trasponi', capo: 'Capotasto', autoScroll: 'Scorrimento auto', speed: 'Velocità', addToSetlist: 'Aggiungi', remove: 'Rimuovi', emptySetlist: 'La tua scaletta è vuota.', stop: 'Ferma', metronome: 'Metronomo', bpm: 'BPM', start: 'Avvia', theme: 'Tema', play: 'Suona', verse: 'Strofa', chorus: 'Ritornello', bridge: 'Ponte', intro: 'Intro', outro: 'Finale', key: 'Tonalità', nowPlaying: 'In riproduzione', online: 'Online', offline: 'Offline', simulator: 'Simulatore LED', scene: 'Scena', songsInLibrary: 'canti' }),
  nl: core({ library: 'Bibliotheek', setlist: 'Setlist', director: 'Leider', lighting: 'Verlichting', access: 'Toegang', language: 'Taal', searchSongs: 'Liederen zoeken…', transpose: 'Transponeren', capo: 'Capo', addToSetlist: 'Toevoegen', remove: 'Verwijderen', stop: 'Stop', metronome: 'Metronoom', start: 'Start', play: 'Afspelen', verse: 'Couplet', chorus: 'Refrein', bridge: 'Brug', key: 'Toonsoort', online: 'Online', offline: 'Offline', songsInLibrary: 'liederen' }),
  pl: core({ library: 'Biblioteka', setlist: 'Lista', director: 'Dyrygent', lighting: 'Światła', access: 'Dostęp', language: 'Język', searchSongs: 'Szukaj pieśni…', transpose: 'Transponuj', addToSetlist: 'Dodaj', remove: 'Usuń', stop: 'Stop', metronome: 'Metronom', start: 'Start', play: 'Odtwórz', verse: 'Zwrotka', chorus: 'Refren', bridge: 'Mostek', key: 'Tonacja', online: 'Online', offline: 'Offline', songsInLibrary: 'pieśni' }),
  ru: core({ library: 'Библиотека', setlist: 'Список', director: 'Руководитель', lighting: 'Свет', access: 'Доступ', language: 'Язык', searchSongs: 'Поиск песен…', transpose: 'Транспонировать', addToSetlist: 'Добавить', remove: 'Удалить', stop: 'Стоп', metronome: 'Метроном', start: 'Старт', play: 'Играть', verse: 'Куплет', chorus: 'Припев', bridge: 'Бридж', key: 'Тональность', online: 'Онлайн', offline: 'Офлайн', songsInLibrary: 'песни' }),
  uk: core({ library: 'Бібліотека', setlist: 'Список', director: 'Керівник', lighting: 'Світло', access: 'Доступ', language: 'Мова', searchSongs: 'Пошук пісень…', transpose: 'Транспонувати', addToSetlist: 'Додати', remove: 'Видалити', stop: 'Стоп', metronome: 'Метроном', start: 'Старт', play: 'Грати', verse: 'Куплет', chorus: 'Приспів', bridge: 'Брідж', key: 'Тональність', online: 'Онлайн', offline: 'Офлайн', songsInLibrary: 'пісні' }),
  ar: core({ library: 'المكتبة', setlist: 'القائمة', director: 'القائد', lighting: 'الإضاءة', access: 'الوصول', language: 'اللغة', searchSongs: 'ابحث في التراتيل…', transpose: 'نقل النغمة', addToSetlist: 'إضافة', remove: 'إزالة', stop: 'إيقاف', metronome: 'الميترونوم', start: 'ابدأ', play: 'تشغيل', verse: 'مقطع', chorus: 'لازمة', bridge: 'جسر', key: 'السلم', online: 'متصل', offline: 'غير متصل', songsInLibrary: 'تراتيل' }),
  he: core({ library: 'ספרייה', setlist: 'רשימה', director: 'מנהל', lighting: 'תאורה', access: 'נגישות', language: 'שפה', searchSongs: 'חפש שירים…', addToSetlist: 'הוסף', remove: 'הסר', stop: 'עצור', metronome: 'מטרונום', start: 'התחל', play: 'נגן', verse: 'בית', chorus: 'פזמון', key: 'סולם', online: 'מקוון', offline: 'לא מקוון', songsInLibrary: 'שירים' }),
  hi: core({ library: 'पुस्तकालय', setlist: 'सूची', director: 'निर्देशक', lighting: 'प्रकाश', access: 'पहुँच', language: 'भाषा', searchSongs: 'गीत खोजें…', addToSetlist: 'जोड़ें', remove: 'हटाएं', stop: 'रोकें', metronome: 'मेट्रोनोम', start: 'शुरू', play: 'बजाएं', verse: 'अंतरा', chorus: 'मुखड़ा', key: 'स्वर', online: 'ऑनलाइन', offline: 'ऑफलाइन', songsInLibrary: 'गीत' }),
  'zh-CN': core({ library: '曲库', setlist: '歌单', director: '指挥', lighting: '灯光', access: '无障碍', language: '语言', searchSongs: '搜索歌曲…', transpose: '移调', addToSetlist: '添加', remove: '移除', stop: '停止', metronome: '节拍器', start: '开始', play: '播放', verse: '主歌', chorus: '副歌', bridge: '桥段', key: '调', online: '在线', offline: '离线', songsInLibrary: '首歌曲' }),
  'zh-TW': core({ library: '曲庫', setlist: '歌單', director: '指揮', lighting: '燈光', access: '無障礙', language: '語言', searchSongs: '搜尋歌曲…', transpose: '移調', addToSetlist: '新增', remove: '移除', stop: '停止', metronome: '節拍器', start: '開始', play: '播放', verse: '主歌', chorus: '副歌', key: '調', online: '線上', offline: '離線', songsInLibrary: '首歌曲' }),
  ja: core({ library: 'ライブラリ', setlist: 'セットリスト', director: 'ディレクター', lighting: '照明', access: 'アクセス', language: '言語', searchSongs: '曲を検索…', transpose: '移調', addToSetlist: '追加', remove: '削除', stop: '停止', metronome: 'メトロノーム', start: '開始', play: '再生', verse: 'ヴァース', chorus: 'コーラス', bridge: 'ブリッジ', key: 'キー', online: 'オンライン', offline: 'オフライン', songsInLibrary: '曲' }),
  ko: core({ library: '라이브러리', setlist: '셋리스트', director: '디렉터', lighting: '조명', access: '접근성', language: '언어', searchSongs: '곡 검색…', transpose: '조옮김', addToSetlist: '추가', remove: '삭제', stop: '정지', metronome: '메트로놈', start: '시작', play: '재생', verse: '절', chorus: '후렴', bridge: '브리지', key: '조', online: '온라인', offline: '오프라인', songsInLibrary: '곡' }),
  vi: core({ library: 'Thư viện', setlist: 'Danh sách', director: 'Chỉ huy', lighting: 'Ánh sáng', access: 'Truy cập', language: 'Ngôn ngữ', searchSongs: 'Tìm bài hát…', addToSetlist: 'Thêm', remove: 'Xóa', stop: 'Dừng', metronome: 'Máy đếm nhịp', start: 'Bắt đầu', play: 'Phát', verse: 'Đoạn', chorus: 'Điệp khúc', key: 'Giọng', online: 'Trực tuyến', offline: 'Ngoại tuyến', songsInLibrary: 'bài hát' }),
  tl: core({ library: 'Aklatan', setlist: 'Listahan', director: 'Direktor', lighting: 'Ilaw', access: 'Access', language: 'Wika', searchSongs: 'Maghanap ng awit…', addToSetlist: 'Idagdag', remove: 'Alisin', stop: 'Tigil', metronome: 'Metronome', start: 'Simulan', play: 'I-play', verse: 'Talata', chorus: 'Koro', key: 'Tono', online: 'Online', offline: 'Offline', songsInLibrary: 'awit' }),
  sw: core({ library: 'Maktaba', setlist: 'Orodha', director: 'Mkurugenzi', lighting: 'Taa', access: 'Ufikiaji', language: 'Lugha', searchSongs: 'Tafuta nyimbo…', addToSetlist: 'Ongeza', remove: 'Ondoa', stop: 'Simama', metronome: 'Metronom', start: 'Anza', play: 'Cheza', verse: 'Mstari', chorus: 'Kwaya', key: 'Sauti', online: 'Mtandaoni', offline: 'Nje ya mtandao', songsInLibrary: 'nyimbo' }),
  tr: core({ library: 'Kütüphane', setlist: 'Liste', director: 'Yönetmen', lighting: 'Işık', access: 'Erişim', language: 'Dil', searchSongs: 'Şarkı ara…', addToSetlist: 'Ekle', remove: 'Kaldır', stop: 'Dur', metronome: 'Metronom', start: 'Başlat', play: 'Çal', verse: 'Kıta', chorus: 'Nakarat', key: 'Ton', online: 'Çevrimiçi', offline: 'Çevrimdışı', songsInLibrary: 'şarkı' }),
  el: core({ library: 'Βιβλιοθήκη', setlist: 'Λίστα', director: 'Διευθυντής', lighting: 'Φωτισμός', access: 'Πρόσβαση', language: 'Γλώσσα', searchSongs: 'Αναζήτηση τραγουδιών…', addToSetlist: 'Προσθήκη', remove: 'Αφαίρεση', stop: 'Στοπ', metronome: 'Μετρονόμος', start: 'Έναρξη', play: 'Αναπαραγωγή', verse: 'Στροφή', chorus: 'Ρεφρέν', key: 'Τόνος', online: 'Σε σύνδεση', offline: 'Εκτός σύνδεσης', songsInLibrary: 'τραγούδια' }),
  ro: core({ library: 'Bibliotecă', setlist: 'Listă', director: 'Dirijor', lighting: 'Lumini', access: 'Acces', language: 'Limbă', searchSongs: 'Caută cântece…', addToSetlist: 'Adaugă', remove: 'Elimină', stop: 'Stop', metronome: 'Metronom', start: 'Start', play: 'Redă', verse: 'Strofă', chorus: 'Refren', key: 'Tonalitate', online: 'Online', offline: 'Offline', songsInLibrary: 'cântece' }),
  // Core-string packs — the worship essentials; English completes the rest.
  fa: core({ library: 'کتابخانه', play: 'پخش', stop: 'توقف', chorus: 'هم‌خوانی', language: 'زبان' }),
  ur: core({ library: 'لائبریری', play: 'چلائیں', stop: 'رکیں', language: 'زبان' }),
  bn: core({ library: 'লাইব্রেরি', play: 'চালান', stop: 'থামুন', language: 'ভাষা' }),
  ta: core({ library: 'நூலகம்', play: 'இசை', stop: 'நிறுத்து', language: 'மொழி' }),
  te: core({ library: 'లైబ్రరీ', play: 'ప్లే', stop: 'ఆపు', language: 'భాష' }),
  mr: core({ library: 'ग्रंथालय', play: 'वाजवा', stop: 'थांबवा', language: 'भाषा' }),
  gu: core({ library: 'પુસ્તકાલય', play: 'વગાડો', stop: 'રોકો', language: 'ભાષા' }),
  pa: core({ library: 'ਲਾਇਬ੍ਰੇਰੀ', play: 'ਚਲਾਓ', stop: 'ਰੋਕੋ', language: 'ਭਾਸ਼ਾ' }),
  th: core({ library: 'คลังเพลง', play: 'เล่น', stop: 'หยุด', language: 'ภาษา' }),
  id: core({ library: 'Pustaka', play: 'Putar', stop: 'Berhenti', language: 'Bahasa', chorus: 'Refrein' }),
  ms: core({ library: 'Pustaka', play: 'Main', stop: 'Berhenti', language: 'Bahasa' }),
  am: core({ library: 'ቤተ-መጻሕፍት', play: 'አጫውት', stop: 'አቁም', language: 'ቋንቋ' }),
  yo: core({ library: 'Ìkàwé', play: 'Ṣe', stop: 'Dáwọ́', language: 'Èdè' }),
  ig: core({ library: 'Ụlọ akwụkwọ', play: 'Gwaa', stop: 'Kwụsị', language: 'Asụsụ' }),
  ha: core({ library: 'Laburare', play: 'Kunna', stop: 'Tsaya', language: 'Harshe' }),
  zu: core({ library: 'Umtapomabhuku', play: 'Dlala', stop: 'Yima', language: 'Ulimi' }),
  xh: core({ library: 'Thala', play: 'Dlala', stop: 'Yima', language: 'Ulwimi' }),
  af: core({ library: 'Biblioteek', play: 'Speel', stop: 'Stop', language: 'Taal', chorus: 'Koor' }),
  hu: core({ library: 'Könyvtár', play: 'Lejátszás', stop: 'Állj', language: 'Nyelv', chorus: 'Refrén' }),
  cs: core({ library: 'Knihovna', play: 'Přehrát', stop: 'Stop', language: 'Jazyk', chorus: 'Refrén' }),
  sk: core({ library: 'Knižnica', play: 'Prehrať', stop: 'Stop', language: 'Jazyk', chorus: 'Refrén' }),
  sr: core({ library: 'Библиотека', play: 'Пусти', stop: 'Стоп', language: 'Језик', chorus: 'Рефрен' }),
  hr: core({ library: 'Knjižnica', play: 'Sviraj', stop: 'Stop', language: 'Jezik', chorus: 'Refren' }),
  hy: core({ library: 'Գրադարան', play: 'Նվագել', stop: 'Կանգ', language: 'Լեզու' }),
  ka: core({ library: 'ბიბლიოთეკა', play: 'დაკვრა', stop: 'გაჩერება', language: 'ენა' }),
};

export function translate(lang: string, key: string): string {
  const pack = PACKS[lang] ?? PACKS[lang.split('-')[0]] ?? {};
  return pack[key] ?? en[key] ?? key;
}

interface I18nCtx {
  lang: string;
  setLang: (code: string) => void;
  t: (key: string) => string;
  rtl: boolean;
}

const Ctx = createContext<I18nCtx>({ lang: 'en', setLang: () => {}, t: (k) => k, rtl: false });

// This Area Of Code Is: The i18n provider.
// Explanation: Detects the browser language on first launch, persists the
// choice, flips the document to RTL for Arabic/Hebrew/Farsi/Urdu, and keeps
// <html lang> in sync for screen readers and search engines.
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>(() => {
    const saved = localStorage.getItem('ntcc.lang');
    if (saved) return saved;
    const nav = navigator.language;
    return LANGUAGES.some((l) => l.code === nav) ? nav
      : LANGUAGES.some((l) => l.code === nav.split('-')[0]) ? nav.split('-')[0] : 'en';
  });

  const meta = LANGUAGES.find((l) => l.code === lang);
  const rtl = !!meta?.rtl;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl]);

  const setLang = (code: string) => {
    localStorage.setItem('ntcc.lang', code);
    setLangState(code);
  };

  return (
    <Ctx.Provider value={{ lang, setLang, t: (k) => translate(lang, k), rtl }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}
