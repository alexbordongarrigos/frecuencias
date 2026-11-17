import { useEffect, useRef } from 'react';

export type LangCode =
  | 'es' | 'en' | 'zh' | 'hi' | 'ar' | 'pt' | 'fr' | 'ru' | 'ja' | 'de'
  | 'ko' | 'it' | 'tr' | 'vi' | 'pl' | 'nl' | 'id' | 'th' | 'uk' | 'el'
  | 'he' | 'sv' | 'cs' | 'ro' | 'hu' | 'fi' | 'da' | 'no' | 'ca' | 'sw';

export interface LanguageOption {
  code: LangCode;
  nativeName: string;
  englishName: string;
  regionLabel: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', regionLabel: 'ES', dir: 'ltr' },
  { code: 'en', nativeName: 'English', englishName: 'English', regionLabel: 'EN', dir: 'ltr' },
  { code: 'zh', nativeName: '中文 (简体)', englishName: 'Chinese', regionLabel: 'ZH', dir: 'ltr' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', regionLabel: 'HI', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', regionLabel: 'AR', dir: 'rtl' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', regionLabel: 'PT', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', regionLabel: 'FR', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', regionLabel: 'RU', dir: 'ltr' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', regionLabel: 'JA', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', regionLabel: 'DE', dir: 'ltr' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', regionLabel: 'KO', dir: 'ltr' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', regionLabel: 'IT', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', regionLabel: 'TR', dir: 'ltr' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', regionLabel: 'VI', dir: 'ltr' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish', regionLabel: 'PL', dir: 'ltr' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', regionLabel: 'NL', dir: 'ltr' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', regionLabel: 'ID', dir: 'ltr' },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai', regionLabel: 'TH', dir: 'ltr' },
  { code: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', regionLabel: 'UK', dir: 'ltr' },
  { code: 'el', nativeName: 'Ελληνικά', englishName: 'Greek', regionLabel: 'EL', dir: 'ltr' },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew', regionLabel: 'HE', dir: 'rtl' },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish', regionLabel: 'SV', dir: 'ltr' },
  { code: 'cs', nativeName: 'Čeština', englishName: 'Czech', regionLabel: 'CS', dir: 'ltr' },
  { code: 'ro', nativeName: 'Română', englishName: 'Romanian', regionLabel: 'RO', dir: 'ltr' },
  { code: 'hu', nativeName: 'Magyar', englishName: 'Hungarian', regionLabel: 'HU', dir: 'ltr' },
  { code: 'fi', nativeName: 'Suomi', englishName: 'Finnish', regionLabel: 'FI', dir: 'ltr' },
  { code: 'da', nativeName: 'Dansk', englishName: 'Danish', regionLabel: 'DA', dir: 'ltr' },
  { code: 'no', nativeName: 'Norsk', englishName: 'Norwegian', regionLabel: 'NO', dir: 'ltr' },
  { code: 'ca', nativeName: 'Català', englishName: 'Catalan', regionLabel: 'CA', dir: 'ltr' },
  { code: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili', regionLabel: 'SW', dir: 'ltr' },
];

type TranslationDict = Record<string, string>;

// Complete high-precision dictionaries for primary UI phrases across core languages,
// plus term-by-term fallback for all 30 global languages.
const LANG_DICTS: Partial<Record<LangCode, TranslationDict>> = {
  en: {
    'Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica ·': 'Harmonic Synthesis, Wave Physics & Quantum Resonance Laboratory ·',
    'Sensor Acústico': 'Acoustic Sensor',
    'Sistemas Nativos': 'Native Systems',
    'Conectar StarSeed OS': 'Connect StarSeed OS',
    'Inicio': 'Home',
    'Fundamentos & Campo': 'Foundations & Field',
    'Librería': 'Library',
    'Espectrómetro': 'Spectrometer',
    'Síntesis & Cimática': 'Synthesis & Cymatics',
    'Comunidad': 'Community',
    'Red P2P & Mesh': 'P2P & Mesh Network',
    'StarSeed OS · Arquitectura de Resonancia Armónica y Biofísica': 'StarSeed OS · Harmonic Resonance & Biophysics Architecture',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'Multi-Wave Synthesis, Cymatic Geometry & Field Coherence',
    'Instrumentación acústica, electromagnética y biofotónica para la generación de ondas estacionarias, análisis de interferencia armónica, proyección nodal tridimensional y sincronización resonante colectiva.': 'Acoustic, electromagnetic, and biophotonic instrumentation for standing wave generation, harmonic interference analysis, three-dimensional nodal projection, and collective resonant synchronization.',
    'Tríada Espectral': 'Spectral Triad',
    'Osciloscopio 2D': '2D Oscilloscope',
    'Cimática Nodal 3D': '3D Nodal Cymatics',
    'Espiral Logarítmica φ': 'Logarithmic Spiral φ',
    'Superposición Temporal 2D': '2D Temporal Superposition',
    'Morfología Nodal Chladni 3D': '3D Chladni Nodal Morphology',
    'Progresión Espiral Cuántica φ': 'Quantum Spiral Progression φ',
    'Captación Acústica Ambiental': 'Ambient Acoustic Capture',
    'Captación Acústica Activa': 'Acoustic Capture Active',
    'Explorar Catálogo Espectral': 'Explore Spectral Catalog',
    'Abrir Espectrómetro': 'Open Spectrometer',
    'Fundamentos Físicos y Metafísicos': 'Physical & Metaphysical Foundations',
    'Arquitectura de Transducción y Coherencia Armónica': 'Transduction Architecture & Harmonic Coherence',
    'Seis subsistemas interconectados que integran síntesis espectral de precisión, física nodal cimática y redes distribuidas sin dependencias centralizadas.': 'Six interconnected subsystems integrating precision spectral synthesis, cymatic nodal physics, and distributed networks without centralized dependencies.',
    'Espectrómetro & Síntesis Multi-Onda': 'Spectrometer & Multi-Wave Synthesis',
    'Morfología Nodal Chladni & Espiral φ': 'Chladni Nodal Morphology & Spiral φ',
    'Taxonomía Espectral & Bio-Resonancia': 'Spectral Taxonomy & Bio-Resonance',
    'Transducción Física & Espectro Óptico': 'Physical Transduction & Optical Spectrum',
    'Sincronización Colectiva & Red Mesh P2P': 'Collective Sync & P2P Mesh Network',
    'Identidad & Archivo Soberano StarSeed OS': 'StarSeed OS Identity & Sovereign Archive',
    'Física Aplicada de Transducción': 'Applied Transduction Physics',
    'Medios Físicos de Emisión y Acoplamiento Energético': 'Physical Emission & Energy Coupling Mediums',
    'Selecciona un dominio de propagación para consultar sus bandas fundamentales en Hz, portadoras en kHz/MHz, longitud de onda óptica equivalente en nanómetros (nm) y rangos de excitación eléctrica (V, A y W).': 'Select a propagation domain to inspect fundamental Hz bands, kHz/MHz carriers, equivalent optical wavelengths in nanometers (nm), and electrical excitation ranges (V, A, W).',
    'Ejecutables Nativos de Baja Latencia': 'Low-Latency Native Executables',
    'Acceso directo a procesamiento por hardware para síntesis AudioWorklet de baja latencia, proyección nodal 3D, retención de pantalla y sincronización P2P local sin conexión.': 'Direct hardware acceleration for low-latency AudioWorklet synthesis, 3D nodal projection, wake lock, and offline local P2P synchronization.',
    'Enlaces Oficiales StarSeed System': 'Official StarSeed System Links',
    'Buscar frecuencia (Hz), resonancia celular, mineral, ecuación armónica o medio físico...': 'Search frequency (Hz), cellular resonance, mineral, harmonic equation, or physical medium...',
    'Medio Físico de Transducción y Radiación': 'Physical Transduction & Radiation Medium',
    'Taxonomía Espectral y Dominios de Resonancia': 'Spectral Taxonomy & Resonance Domains',
    'Todos los Medios': 'All Mediums',
    'Compactar Filtros': 'Collapse Filters',
    'Categorías y Medios': 'Categories & Mediums',
    'Todas': 'All',
    'Solfeggio & Armónicos': 'Solfeggio & Harmonics',
    'Cósmicas & Planetarias': 'Cosmic & Planetary',
    'Naturaleza, Agua & Cristales': 'Nature, Water & Crystals',
    'Cuerpo, Celular & Biofísica': 'Body, Cellular & Biophysics',
    'Rife, Nogier & Bio-Resonancia': 'Rife, Nogier & Bio-Resonance',
    'PEMF, Fotónica & Plasma': 'PEMF, Photonics & Plasma',
    'Neuroacústica & Cerebro': 'Neuroacoustics & Brain',
    'Numerología, Fibonacci & Phi': 'Numerology, Fibonacci & Phi',
    'Arqueoacústica & Megalitos': 'Archaeoacoustics & Megaliths',
    'Chakras & Vórtex': 'Chakras & Vortex',
    'Ritmos & Isocrónicos': 'Rhythms & Isochronic',
    'Pitagóricas & Microtonales': 'Pythagorean & Microtonal',
    'Música Sagrada': 'Sacred Music',
    'Sinergias & Ecuaciones': 'Synergies & Equations',
    'Ondas 2D': '2D Waves',
    'Cimática 3D': '3D Cymatics',
    'Espiral Holográfico': 'Holographic Spiral',
    'Espiral Holográfica': 'Holographic Spiral',
    'Síntesis Asistida IA': 'AI-Assisted Synthesis',
    'Guardar Preset': 'Save Preset',
    'Cargar Preset': 'Load Preset',
    'Transmitir en Vivo': 'Broadcast Live',
    'Deshacer': 'Undo',
    'Rehacer': 'Redo',
    'Exportar v.7': 'Export v.7',
    'Importar': 'Import',
    'Añadir Frecuencia': 'Add Frequency',
    'Nueva capa armónica': 'New harmonic layer',
    'Niveladores Globales': 'Global Levelers',
    'Ocultar Nivelador Global': 'Hide Global Leveler',
    'Desplegar Todas': 'Expand All',
    'Compactar Todas': 'Collapse All',
    'Volumen Global': 'Global Volume',
    'Centrar Posiciones': 'Center Positions',
    'Onda Global': 'Global Wave',
    'Desplegar Niveladores y Ajustes': 'Expand Levelers & Settings',
    'Ocultar Niveladores y Ajustes': 'Hide Levelers & Settings',
    'Pantalla Completa': 'Fullscreen',
    'Salir Pantalla Completa (Esc)': 'Exit Fullscreen (Esc)',
    'Niveladores 3D': '3D Levelers',
    'Niveladores Espiral': 'Spiral Levelers',
    'Ocultar Ajustes': 'Hide Settings',
    'Abrir Ajustes': 'Open Settings',
    'Reproduciendo': 'Playing',
    'Pausado': 'Paused',
    'Silencio Total': 'Total Silence',
    'Silenciado': 'Muted',
    'Ajustes': 'Settings',
    'Escuchar': 'Listen',
    'Detener': 'Stop',
    'Cargar en Espectrómetro': 'Load in Spectrometer',
    'Mezclar': 'Mix',
    'Propiedades': 'Properties',
    'Recomendación Técnica': 'Technical Recommendation',
    'Frecuencias y Configuraciones': 'Frequencies & Configurations',
    'Análisis de Interferencia Constructiva, Diferenciales de Frecuencia (Δf) y Coherencia de Fase': 'Constructive Interference, Frequency Differentials (Δf) & Phase Coherence Analysis',
    'Modo Invitado / P2P': 'Guest / P2P Mode',
    'Acceso a red pública, Mesh y sintonizaciones en línea': 'Public network, Mesh & live synchronization access',
    'Partículas': 'Particles',
    'Sintonización': 'Synchronization',
    'Perfiles': 'Profiles',
    'Radar Mesh': 'Mesh Radar',
    'Publicar Partícula': 'Publish Particle',
    'Recientes': 'Recent',
    'Populares': 'Popular',
    'Senoidal': 'Sine',
    'Cuadrada': 'Square',
    'Diente': 'Sawtooth',
    'Triangular': 'Triangle',
    'Descargar': 'Download',
    'Origen': 'Origin',
    'Acústica': 'Acoustics',
    'Magnética': 'Magnetic',
    'Fotónica IR': 'IR Photonics',
    'Fotónica UV/Luz': 'UV/Light Photonics',
    'Iónica / Plasma': 'Ionic / Plasma',
    'Multi-Medio': 'Multi-Medium',
    'Idioma': 'Language',
  },
  pt: {
    'Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica ·': 'Laboratório de Síntese Harmônica, Física Ondulatória e Ressonância Quântica ·',
    'Sensor Acústico': 'Sensor Acústico',
    'Sistemas Nativos': 'Sistemas Nativos',
    'Conectar StarSeed OS': 'Conectar StarSeed OS',
    'Inicio': 'Início',
    'Fundamentos & Campo': 'Fundamentos & Campo',
    'Librería': 'Biblioteca',
    'Espectrómetro': 'Espectrômetro',
    'Síntesis & Cimática': 'Síntese & Cimática',
    'Comunidad': 'Comunidade',
    'Red P2P & Mesh': 'Rede P2P & Mesh',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'Síntese Multi-Onda, Geometria Cimática e Coerência de Campo',
    'Instrumentación acústica, electromagnética y biofotónica para la generación de ondas estacionarias, análisis de interferencia armónica, proyección nodal tridimensional y sincronización resonante colectiva.': 'Instrumentação acústica, eletromagnética e biofotônica para geração de ondas estacionárias, análise de interferência harmônica, projeção nodal tridimensional e sincronização ressonante coletiva.',
    'Tríada Espectral': 'Tríade Espectral',
    'Osciloscopio 2D': 'Osciloscópio 2D',
    'Cimática Nodal 3D': 'Cimática Nodal 3D',
    'Espiral Logarítmica φ': 'Espiral Logarítmica φ',
    'Captación Acústica Ambiental': 'Captação Acústica Ambiental',
    'Captación Acústica Activa': 'Captação Acústica Ativa',
    'Explorar Catálogo Espectral': 'Explorar Catálogo Espectral',
    'Abrir Espectrómetro': 'Abrir Espectrômetro',
    'Medios Físicos de Emisión y Acoplamiento Energético': 'Meios Físicos de Emissão e Acoplamento Energético',
    'Ejecutables Nativos de Baja Latencia': 'Executáveis Nativos de Baixa Latência',
    'Todos los Medios': 'Todos os Meios',
    'Compactar Filtros': 'Recolher Filtros',
    'Ondas 2D': 'Ondas 2D',
    'Cimática 3D': 'Cimática 3D',
    'Espiral Holográfico': 'Espiral Holográfica',
    'Síntesis Asistida IA': 'Síntese Assistida IA',
    'Guardar Preset': 'Salvar Preset',
    'Cargar Preset': 'Carregar Preset',
    'Transmitir en Vivo': 'Transmitir ao Vivo',
    'Deshacer': 'Desfazer',
    'Rehacer': 'Refazer',
    'Añadir Frecuencia': 'Adicionar Frequência',
    'Desplegar Niveladores y Ajustes': 'Expandir Niveladores e Ajustes',
    'Ocultar Niveladores y Ajustes': 'Ocultar Niveladores e Ajustes',
    'Pantalla Completa': 'Tela Cheia',
    'Salir Pantalla Completa (Esc)': 'Sair da Tela Cheia (Esc)',
    'Reproduciendo': 'Reproduzindo',
    'Pausado': 'Pausado',
    'Ajustes': 'Ajustes',
    'Escuchar': 'Ouvir',
    'Detener': 'Parar',
    'Cargar en Espectrómetro': 'Carregar no Espectrômetro',
    'Mezclar': 'Misturar',
    'Propiedades': 'Propriedades',
    'Recomendación Técnica': 'Recomendação Técnica',
    'Frecuencias y Configuraciones': 'Frequências e Configurações',
    'Descargar': 'Baixar',
    'Idioma': 'Idioma',
  },
  fr: {
    'Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica ·': 'Laboratoire de Synthèse Harmonique, Physique Ondulatoire et Résonance Quantique ·',
    'Sensor Acústico': 'Capteur Acoustique',
    'Sistemas Nativos': 'Systèmes Natifs',
    'Conectar StarSeed OS': 'Connecter StarSeed OS',
    'Inicio': 'Accueil',
    'Fundamentos & Campo': 'Fondements & Champ',
    'Librería': 'Bibliothèque',
    'Espectrómetro': 'Spectromètre',
    'Síntesis & Cimática': 'Synthèse & Cymatique',
    'Comunidad': 'Communauté',
    'Red P2P & Mesh': 'Réseau P2P & Mesh',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'Synthèse Multi-Ondes, Géométrie Cymatique et Cohérence de Champ',
    'Instrumentación acústica, electromagnética y biofotónica para la generación de ondas estacionarias, análisis de interferencia armónica, proyección nodal tridimensional y sincronización resonante colectiva.': 'Instrumentation acoustique, électromagnétique et biophotonique pour la génération d’ondes stationnaires, l’analyse d’interférences harmoniques, la projection nodale 3D et la synchronisation résonante collective.',
    'Tríada Espectral': 'Triade Spectrale',
    'Osciloscopio 2D': 'Oscilloscope 2D',
    'Cimática Nodal 3D': 'Cymatique Nodale 3D',
    'Espiral Logarítmica φ': 'Spirale Logarithmique φ',
    'Captación Acústica Ambiental': 'Capture Acoustique Ambiante',
    'Captación Acústica Activa': 'Capture Acoustique Active',
    'Explorar Catálogo Espectral': 'Explorer le Catalogue Spectral',
    'Abrir Espectrómetro': 'Ouvrir le Spectromètre',
    'Medios Físicos de Emisión y Acoplamiento Energético': 'Milieux Physiques d’Émission et Couplage Énergétique',
    'Ejecutables Nativos de Baja Latencia': 'Exécutables Natifs Basse Latence',
    'Todos los Medios': 'Tous les Milieux',
    'Compactar Filtros': 'Réduire les Filtres',
    'Ondas 2D': 'Ondes 2D',
    'Cimática 3D': 'Cymatique 3D',
    'Espiral Holográfico': 'Spirale Holographique',
    'Síntesis Asistida IA': 'Synthèse Assistée IA',
    'Guardar Preset': 'Enregistrer Preset',
    'Cargar Preset': 'Charger Preset',
    'Transmitir en Vivo': 'Diffuser en Direct',
    'Deshacer': 'Annuler',
    'Rehacer': 'Rétablir',
    'Añadir Frecuencia': 'Ajouter Fréquence',
    'Desplegar Niveladores y Ajustes': 'Déplier Niveaux & Réglages',
    'Ocultar Niveladores y Ajustes': 'Masquer Niveaux & Réglages',
    'Pantalla Completa': 'Plein Écran',
    'Salir Pantalla Completa (Esc)': 'Quitter Plein Écran (Échap)',
    'Reproduciendo': 'Lecture en cours',
    'Pausado': 'En pause',
    'Ajustes': 'Réglages',
    'Escuchar': 'Écouter',
    'Detener': 'Arrêter',
    'Cargar en Espectrómetro': 'Charger dans le Spectromètre',
    'Mezclar': 'Mixer',
    'Propiedades': 'Propriétés',
    'Recomendación Técnica': 'Recommandation Technique',
    'Frecuencias y Configuraciones': 'Fréquences et Configurations',
    'Descargar': 'Télécharger',
    'Idioma': 'Langue',
  },
  de: {
    'Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica ·': 'Labor für Harmonische Synthese, Wellenphysik & Quantenresonanz ·',
    'Sensor Acústico': 'Akustiksensor',
    'Sistemas Nativos': 'Native Systeme',
    'Conectar StarSeed OS': 'StarSeed OS verbinden',
    'Inicio': 'Start',
    'Fundamentos & Campo': 'Grundlagen & Feld',
    'Librería': 'Bibliothek',
    'Espectrómetro': 'Spektrometer',
    'Síntesis & Cimática': 'Synthese & Kymatik',
    'Comunidad': 'Gemeinschaft',
    'Red P2P & Mesh': 'P2P & Mesh-Netz',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'Multiwellen-Synthese, Kymatische Geometrie & Feldkohärenz',
    'Instrumentación acústica, electromagnética y biofotónica para la generación de ondas estacionarias, análisis de interferencia armónica, proyección nodal tridimensional y sincronización resonante colectiva.': 'Akustische, elektromagnetische und biophotonische Instrumentierung zur Erzeugung stehender Wellen, harmonischer Interferenzanalyse, 3D-Knotenprojektion und kollektiver Resonanzsynchronisation.',
    'Tríada Espectral': 'Spektrale Triade',
    'Osciloscopio 2D': '2D-Oszilloskop',
    'Cimática Nodal 3D': '3D-Knotenkymatik',
    'Espiral Logarítmica φ': 'Logarithmische Spirale φ',
    'Captación Acústica Ambiental': 'Umgebungs-Akustikerfassung',
    'Explorar Catálogo Espectral': 'Spektralkatalog erkunden',
    'Abrir Espectrómetro': 'Spektrometer öffnen',
    'Medios Físicos de Emisión y Acoplamiento Energético': 'Physikalische Emissions- & Kopplungsmedien',
    'Ejecutables Nativos de Baja Latencia': 'Native Echtzeit-Anwendungen',
    'Todos los Medios': 'Alle Medien',
    'Compactar Filtros': 'Filter einklappen',
    'Ondas 2D': '2D-Wellen',
    'Cimática 3D': '3D-Kymatik',
    'Espiral Holográfico': 'Holographische Spirale',
    'Síntesis Asistida IA': 'KI-Synthese',
    'Guardar Preset': 'Preset speichern',
    'Cargar Preset': 'Preset laden',
    'Transmitir en Vivo': 'Live übertragen',
    'Deshacer': 'Rückgängig',
    'Rehacer': 'Wiederholen',
    'Añadir Frecuencia': 'Frequenz hinzufügen',
    'Desplegar Niveladores y Ajustes': 'Regler & Einstellungen öffnen',
    'Ocultar Niveladores y Ajustes': 'Regler & Einstellungen schließen',
    'Pantalla Completa': 'Vollbild',
    'Salir Pantalla Completa (Esc)': 'Vollbild beenden (Esc)',
    'Reproduciendo': 'Wiedergabe',
    'Pausado': 'Pausiert',
    'Ajustes': 'Einstellungen',
    'Escuchar': 'Anhören',
    'Detener': 'Stopp',
    'Cargar en Espectrómetro': 'Ins Spektrometer laden',
    'Mezclar': 'Mischen',
    'Propiedades': 'Eigenschaften',
    'Recomendación Técnica': 'Technische Empfehlung',
    'Frecuencias y Configuraciones': 'Frequenzen & Konfigurationen',
    'Descargar': 'Herunterladen',
    'Idioma': 'Sprache',
  },
  it: {
    'Sensor Acústico': 'Sensore Acustico',
    'Sistemas Nativos': 'Sistemi Nativi',
    'Inicio': 'Inizio',
    'Fundamentos & Campo': 'Fondamenti & Campo',
    'Librería': 'Libreria',
    'Espectrómetro': 'Spettrometro',
    'Síntesis & Cimática': 'Sintesi & Cimatica',
    'Comunidad': 'Comunità',
    'Red P2P & Mesh': 'Rete P2P & Mesh',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'Sintesi Multi-Onda, Geometria Cimatica e Coerenza di Campo',
    'Tríada Espectral': 'Triade Spettrale',
    'Osciloscopio 2D': 'Oscilloscopio 2D',
    'Cimática Nodal 3D': 'Cimatica Nodale 3D',
    'Espiral Logarítmica φ': 'Spirale Logaritmica φ',
    'Explorar Catálogo Espectral': 'Esplora Catalogo Spettrale',
    'Abrir Espectrómetro': 'Apri Spettrometro',
    'Todos los Medios': 'Tutti i Mezzi',
    'Ondas 2D': 'Onde 2D',
    'Cimática 3D': 'Cimatica 3D',
    'Espiral Holográfico': 'Spirale Olografica',
    'Síntesis Asistida IA': 'Sintesi Assistita IA',
    'Guardar Preset': 'Salva Preset',
    'Cargar Preset': 'Carica Preset',
    'Transmitir en Vivo': 'Trasmetti dal Vivo',
    'Deshacer': 'Annulla',
    'Rehacer': 'Ripeti',
    'Añadir Frecuencia': 'Aggiungi Frequenza',
    'Desplegar Niveladores y Ajustes': 'Espandi Livelli e Regolazioni',
    'Ocultar Niveladores y Ajustes': 'Nascondi Livelli e Regolazioni',
    'Pantalla Completa': 'Schermo Intero',
    'Reproduciendo': 'In riproduzione',
    'Pausado': 'In pausa',
    'Ajustes': 'Impostazioni',
    'Escuchar': 'Ascolta',
    'Cargar en Espectrómetro': 'Carica nello Spettrometro',
    'Mezclar': 'Mischia',
    'Descargar': 'Scarica',
    'Idioma': 'Lingua',
  },
  zh: {
    'Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica ·': '谐波合成、波动物理与量子共振实验室 ·',
    'Sensor Acústico': '声学传感器',
    'Sistemas Nativos': '原生系统',
    'Conectar StarSeed OS': '连接 StarSeed OS',
    'Inicio': '首页',
    'Fundamentos & Campo': '基础与场域',
    'Librería': '频率库',
    'Espectrómetro': '频谱仪',
    'Síntesis & Cimática': '合成与克拉尼',
    'Comunidad': '社区',
    'Red P2P & Mesh': 'P2P 与 Mesh 网络',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': '多波合成、克拉尼几何与场域相干性',
    'Instrumentación acústica, electromagnética y biofotónica para la generación de ondas estacionarias, análisis de interferencia armónica, proyección nodal tridimensional y sincronización resonante colectiva.': '声学、电磁与生物光子仪器，用于驻波生成、谐波干涉分析、三维节线投影与群体共振同步。',
    'Tríada Espectral': '三维光谱三联图',
    'Osciloscopio 2D': '2D 示波器',
    'Cimática Nodal 3D': '3D 克拉尼节线',
    'Espiral Logarítmica φ': '对数螺旋 φ',
    'Captación Acústica Ambiental': '环境声学采集',
    'Captación Acústica Activa': '声学采集中',
    'Explorar Catálogo Espectral': '浏览频谱目录',
    'Abrir Espectrómetro': '打开频谱仪',
    'Medios Físicos de Emisión y Acoplamiento Energético': '物理发射与能量耦合介质',
    'Ejecutables Nativos de Baja Latencia': '低延迟原生客户端',
    'Todos los Medios': '全部介质',
    'Compactar Filtros': '收起筛选',
    'Todas': '全部',
    'Ondas 2D': '2D 波形',
    'Cimática 3D': '3D 克拉尼',
    'Espiral Holográfico': '全息螺旋',
    'Síntesis Asistida IA': 'AI 辅助合成',
    'Guardar Preset': '保存预设',
    'Cargar Preset': '加载预设',
    'Transmitir en Vivo': '实时广播',
    'Deshacer': '撤销',
    'Rehacer': '重做',
    'Añadir Frecuencia': '添加频率',
    'Desplegar Niveladores y Ajustes': '展开调节器与设置',
    'Ocultar Niveladores y Ajustes': '收起调节器与设置',
    'Pantalla Completa': '全屏显示',
    'Salir Pantalla Completa (Esc)': '退出全屏 (Esc)',
    'Reproduciendo': '正在播放',
    'Pausado': '已暂停',
    'Ajustes': '设置',
    'Escuchar': '试听',
    'Detener': '停止',
    'Cargar en Espectrómetro': '载入频谱仪',
    'Mezclar': '混音',
    'Propiedades': '属性',
    'Recomendación Técnica': '技术建议',
    'Frecuencias y Configuraciones': '频率与配置',
    'Descargar': '下载',
    'Idioma': '语言',
  },
  ja: {
    'Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica ·': '倍音合成・波動物理・量子共鳴ラボ ·',
    'Sensor Acústico': '音響センサー',
    'Sistemas Nativos': 'ネイティブアプリ',
    'Conectar StarSeed OS': 'StarSeed OS に接続',
    'Inicio': 'ホーム',
    'Fundamentos & Campo': '基礎と共鳴場',
    'Librería': 'ライブラリ',
    'Espectrómetro': 'スペクトロメータ',
    'Síntesis & Cimática': '合成とサイマティクス',
    'Comunidad': 'コミュニティ',
    'Red P2P & Mesh': 'P2P & Mesh ネット',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': '多波合成・サイマティクス幾何学・場のコヒーレンス',
    'Tríada Espectral': '3D スペクトル三連図',
    'Osciloscopio 2D': '2D オシロスコープ',
    'Cimática Nodal 3D': '3D 節線サイマティクス',
    'Espiral Logarítmica φ': '対数螺旋 φ',
    'Captación Acústica Ambiental': '環境音響キャプチャ',
    'Explorar Catálogo Espectral': 'スペクトル図鑑を開く',
    'Abrir Espectrómetro': 'スペクトロメータを開く',
    'Todos los Medios': 'すべての媒体',
    'Compactar Filtros': 'フィルタを閉じる',
    'Todas': 'すべて',
    'Ondas 2D': '2D 波形',
    'Cimática 3D': '3D サイマティクス',
    'Espiral Holográfico': 'ホログラフィック螺旋',
    'Síntesis Asistida IA': 'AI 支援合成',
    'Guardar Preset': 'プリセット保存',
    'Cargar Preset': 'プリセット読込',
    'Transmitir en Vivo': 'ライブ配信',
    'Deshacer': '元に戻す',
    'Rehacer': 'やり直し',
    'Añadir Frecuencia': '周波数を追加',
    'Desplegar Niveladores y Ajustes': 'レベラーと設定を展開',
    'Ocultar Niveladores y Ajustes': 'レベラーと設定を隠す',
    'Pantalla Completa': '全画面表示',
    'Salir Pantalla Completa (Esc)': '全画面終了 (Esc)',
    'Reproduciendo': '再生中',
    'Pausado': '一時停止',
    'Ajustes': '設定',
    'Escuchar': '試聴',
    'Detener': '停止',
    'Cargar en Espectrómetro': 'スペクトロメータへ読込',
    'Mezclar': 'ミックス',
    'Propiedades': '特性',
    'Recomendación Técnica': '技術推奨',
    'Frecuencias y Configuraciones': '周波数と設定',
    'Descargar': 'ダウンロード',
    'Idioma': '言語',
  },
  ko: {
    'Sensor Acústico': '음향 센서',
    'Sistemas Nativos': '네이티브 앱',
    'Conectar StarSeed OS': 'StarSeed OS 연결',
    'Inicio': '홈',
    'Fundamentos & Campo': '기초 및 공명장',
    'Librería': '라이브러리',
    'Espectrómetro': '분광계',
    'Síntesis & Cimática': '합성 & 사이매틱스',
    'Comunidad': '커뮤니티',
    'Red P2P & Mesh': 'P2P & Mesh 네트워크',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': '다중 파동 합성, 사이매틱 기하학 및 장 일관성',
    'Tríada Espectral': '3D 스펙트럼 3원도',
    'Osciloscopio 2D': '2D 오실로스코프',
    'Cimática Nodal 3D': '3D 절선 사이매틱스',
    'Espiral Logarítmica φ': '로그 나선 φ',
    'Explorar Catálogo Espectral': '스펙트럼 카탈로그 탐색',
    'Abrir Espectrómetro': '분광계 열기',
    'Todos los Medios': '모든 매체',
    'Ondas 2D': '2D 파형',
    'Cimática 3D': '3D 사이매틱스',
    'Espiral Holográfico': '홀로그래픽 나선',
    'Guardar Preset': '프리셋 저장',
    'Cargar Preset': '프리셋 불러오기',
    'Transmitir en Vivo': '실시간 송출',
    'Añadir Frecuencia': '주파수 추가',
    'Desplegar Niveladores y Ajustes': '레벨러 및 설정 펼치기',
    'Ocultar Niveladores y Ajustes': '레벨러 및 설정 접기',
    'Pantalla Completa': '전체 화면',
    'Reproduciendo': '재생 중',
    'Pausado': '일시 정지',
    'Ajustes': '설정',
    'Escuchar': '미리 듣기',
    'Cargar en Espectrómetro': '분광계로 불러오기',
    'Descargar': '다운로드',
    'Idioma': '언어',
  },
  ru: {
    'Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica ·': 'Лаборатория гармонического синтеза, волновой физики и квантового резонанса ·',
    'Sensor Acústico': 'Акустический датчик',
    'Sistemas Nativos': 'Нативные приложения',
    'Conectar StarSeed OS': 'Подключить StarSeed OS',
    'Inicio': 'Главная',
    'Fundamentos & Campo': 'Основы и поле',
    'Librería': 'Библиотека',
    'Espectrómetro': 'Спектрометр',
    'Síntesis & Cimática': 'Синтез и киматика',
    'Comunidad': 'Сообщество',
    'Red P2P & Mesh': 'Сеть P2P и Mesh',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'Многоволновой синтез, киматическая геометрия и когерентность поля',
    'Tríada Espectral': 'Спектральная триада',
    'Osciloscopio 2D': '2D Осциллограф',
    'Cimática Nodal 3D': '3D Узловая киматика',
    'Espiral Logarítmica φ': 'Логарифмическая спираль φ',
    'Captación Acústica Ambiental': 'Захват внешней акустики',
    'Explorar Catálogo Espectral': 'Открыть каталог частот',
    'Abrir Espectrómetro': 'Открыть спектрометр',
    'Todos los Medios': 'Все среды',
    'Todas': 'Все',
    'Ondas 2D': '2D Волны',
    'Cimática 3D': '3D Киматика',
    'Espiral Holográfico': 'Голографическая спираль',
    'Síntesis Asistida IA': 'ИИ-синтез',
    'Guardar Preset': 'Сохранить пресет',
    'Cargar Preset': 'Загрузить пресет',
    'Transmitir en Vivo': 'Прямая трансляция',
    'Deshacer': 'Отменить',
    'Rehacer': 'Повторить',
    'Añadir Frecuencia': 'Добавить частоту',
    'Desplegar Niveladores y Ajustes': 'Раскрыть регуляторы',
    'Ocultar Niveladores y Ajustes': 'Скрыть регуляторы',
    'Pantalla Completa': 'Полный экран',
    'Reproduciendo': 'Воспроизведение',
    'Pausado': 'Пауза',
    'Ajustes': 'Настройки',
    'Escuchar': 'Слушать',
    'Cargar en Espectrómetro': 'Загрузить в спектрометр',
    'Mezclar': 'Смешать',
    'Descargar': 'Скачать',
    'Idioma': 'Язык',
  },
  ar: {
    'Sensor Acústico': 'مستشعر صوتي',
    'Sistemas Nativos': 'التطبيقات الأصلية',
    'Inicio': 'الرئيسية',
    'Fundamentos & Campo': 'الأسس والمجال',
    'Librería': 'المكتبة',
    'Espectrómetro': 'المطياف',
    'Comunidad': 'المجتمع',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'التخليق متعدد الموجات، الهندسة السيماتية وتماسك المجال',
    'Tríada Espectral': 'الثالوث الطيفي',
    'Osciloscopio 2D': 'راسم الإشارة 2D',
    'Cimática Nodal 3D': 'السيماتية العقدية 3D',
    'Espiral Logarítmica φ': 'اللولب اللوغاريتمي φ',
    'Ondas 2D': 'موجات 2D',
    'Cimática 3D': 'سيميائية 3D',
    'Espiral Holográfico': 'اللولب الهولوغرافي',
    'Todos los Medios': 'جميع الوسائط',
    'Todas': 'الكل',
    'Añadir Frecuencia': 'إضافة تردد',
    'Desplegar Niveladores y Ajustes': 'عرض المستويات والإعدادات',
    'Ocultar Niveladores y Ajustes': 'إخفاء المستويات والإعدادات',
    'Pantalla Completa': 'ملء الشاشة',
    'Reproduciendo': 'قيد التشغيل',
    'Pausado': 'متوقف مؤقتاً',
    'Ajustes': 'الإعدادات',
    'Escuchar': 'استماع',
    'Cargar en Espectrómetro': 'تحميل في المطياف',
    'Descargar': 'تحميل',
    'Idioma': 'اللغة',
  },
  hi: {
    'Sensor Acústico': 'ध्वनि संवेदक',
    'Sistemas Nativos': 'नेटिव ऐप्स',
    'Inicio': 'मुख्य पृष्ठ',
    'Fundamentos & Campo': 'सिद्धांत व क्षेत्र',
    'Librería': 'पुस्तकालय',
    'Espectrómetro': 'स्पेक्ट्रोमीटर',
    'Comunidad': 'समुदाय',
    'Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo': 'बहु-तरंग संश्लेषण, साइमैटिक ज्यामिति व क्षेत्र सुसंगति',
    'Tríada Espectral': 'स्पेक्ट्रल त्रयी',
    'Osciloscopio 2D': '2D ऑसिलोस्कोप',
    'Cimática Nodal 3D': '3D नोडल साइमैटिक्स',
    'Espiral Logarítmica φ': 'लघुगणकीय सर्पिल φ',
    'Ondas 2D': '2D तरंगें',
    'Cimática 3D': '3D साइमैटिक्स',
    'Espiral Holográfico': 'होलोग्राफ़िक सर्पिल',
    'Todos los Medios': 'सभी माध्यम',
    'Todas': 'सभी',
    'Añadir Frecuencia': 'आवृत्ति जोड़ें',
    'Pantalla Completa': 'पूर्ण स्क्रीन',
    'Reproduciendo': 'चलाया जा रहा है',
    'Pausado': 'रोका गया',
    'Ajustes': 'सेटिंग्स',
    'Escuchar': 'सुनें',
    'Cargar en Espectrómetro': 'स्पेक्ट्रोमीटर में लोड करें',
    'Descargar': 'डाउनलोड',
    'Idioma': 'भाषा',
  },
  tr: {
    'Sensor Acústico': 'Akustik Sensör',
    'Sistemas Nativos': 'Yerel Sistemler',
    'Inicio': 'Ana Sayfa',
    'Librería': 'Kütüphane',
    'Espectrómetro': 'Spektrometre',
    'Comunidad': 'Topluluk',
    'Todos los Medios': 'Tüm Ortamlar',
    'Todas': 'Tümü',
    'Ondas 2D': '2B Dalgalar',
    'Cimática 3D': '3B Simatik',
    'Espiral Holográfico': 'Holografik Spiral',
    'Guardar Preset': 'Ön Ayarı Kaydet',
    'Cargar Preset': 'Ön Ayar Yükle',
    'Añadir Frecuencia': 'Frekans Ekle',
    'Pantalla Completa': 'Tam Ekran',
    'Reproduciendo': 'Oynatılıyor',
    'Pausado': 'Duraklatıldı',
    'Ajustes': 'Ayarlar',
    'Escuchar': 'Dinle',
    'Descargar': 'İndir',
    'Idioma': 'Dil',
  },
  vi: {
    'Sensor Acústico': 'Cảm biến Âm học',
    'Sistemas Nativos': 'Ứng dụng Gốc',
    'Inicio': 'Trang chủ',
    'Librería': 'Thư viện',
    'Espectrómetro': 'Quang phổ kế',
    'Comunidad': 'Cộng đồng',
    'Todas': 'Tất cả',
    'Ondas 2D': 'Sóng 2D',
    'Cimática 3D': 'Cộng hưởng 3D',
    'Espiral Holográfico': 'Xoắn ốc 3D',
    'Añadir Frecuencia': 'Thêm Tần số',
    'Pantalla Completa': 'Toàn màn hình',
    'Reproduciendo': 'Đang phát',
    'Pausado': 'Tạm dừng',
    'Ajustes': 'Cài đặt',
    'Escuchar': 'Nghe thử',
    'Descargar': 'Tải xuống',
    'Idioma': 'Ngôn ngữ',
  },
  pl: {
    'Sensor Acústico': 'Czujnik Akustyczny',
    'Sistemas Nativos': 'Systemy Natywne',
    'Inicio': 'Start',
    'Librería': 'Biblioteka',
    'Espectrómetro': 'Spektrometr',
    'Comunidad': 'Społeczność',
    'Todas': 'Wszystkie',
    'Ondas 2D': 'Fale 2D',
    'Cimática 3D': 'Cymatyka 3D',
    'Espiral Holográfico': 'Spirala Holograficzna',
    'Añadir Frecuencia': 'Dodaj Częstotliwość',
    'Pantalla Completa': 'Pełny ekran',
    'Reproduciendo': 'Odtwarzanie',
    'Pausado': 'Wstrzymano',
    'Ajustes': 'Ustawienia',
    'Escuchar': 'Słuchaj',
    'Descargar': 'Pobierz',
    'Idioma': 'Język',
  },
  nl: {
    'Sensor Acústico': 'Akoestische Sensor',
    'Sistemas Nativos': 'Native Apps',
    'Inicio': 'Start',
    'Librería': 'Bibliotheek',
    'Espectrómetro': 'Spectrometer',
    'Comunidad': 'Gemeenschap',
    'Todas': 'Alle',
    'Ondas 2D': '2D-Golven',
    'Cimática 3D': '3D-Cymatica',
    'Espiral Holográfico': 'Holografische Spiraal',
    'Añadir Frecuencia': 'Frequentie Toevoegen',
    'Pantalla Completa': 'Volledig scherm',
    'Reproduciendo': 'Speelt af',
    'Pausado': 'Gepauzeerd',
    'Ajustes': 'Instellingen',
    'Escuchar': 'Luisteren',
    'Descargar': 'Downloaden',
    'Idioma': 'Taal',
  },
  id: {
    'Sensor Acústico': 'Sensor Akustik',
    'Sistemas Nativos': 'Aplikasi Asli',
    'Inicio': 'Beranda',
    'Librería': 'Pustaka',
    'Espectrómetro': 'Spektrometer',
    'Comunidad': 'Komunitas',
    'Todas': 'Semua',
    'Ondas 2D': 'Gelombang 2D',
    'Cimática 3D': 'Simatika 3D',
    'Espiral Holográfico': 'Spiral Holografik',
    'Añadir Frecuencia': 'Tambah Frekuensi',
    'Pantalla Completa': 'Layar Penuh',
    'Reproduciendo': 'Memutar',
    'Pausado': 'Dijeda',
    'Ajustes': 'Pengaturan',
    'Escuchar': 'Dengarkan',
    'Descargar': 'Unduh',
    'Idioma': 'Bahasa',
  },
  th: {
    'Sensor Acústico': 'เซนเซอร์เสียง',
    'Sistemas Nativos': 'แอปเนทีฟ',
    'Inicio': 'หน้าหลัก',
    'Librería': 'คลังความถี่',
    'Espectrómetro': 'สเปกโตรมิเตอร์',
    'Comunidad': 'ชุมชน',
    'Todas': 'ทั้งหมด',
    'Ondas 2D': 'คลื่น 2D',
    'Cimática 3D': 'ไซแมติกส์ 3D',
    'Espiral Holográfico': 'เกลียวโฮโลกราฟิก',
    'Añadir Frecuencia': 'เพิ่มความถี่',
    'Pantalla Completa': 'เต็มหน้าจอ',
    'Reproduciendo': 'กำลังเล่น',
    'Pausado': 'หยุดชั่วคราว',
    'Ajustes': 'การตั้งค่า',
    'Escuchar': 'ฟัง',
    'Descargar': 'ดาวน์โหลด',
    'Idioma': 'ภาษา',
  },
  uk: {
    'Sensor Acústico': 'Акустичний датчик',
    'Sistemas Nativos': 'Нативні додатки',
    'Inicio': 'Головна',
    'Librería': 'Бібліотека',
    'Espectrómetro': 'Спектрометр',
    'Comunidad': 'Спільнота',
    'Todas': 'Усі',
    'Ondas 2D': '2D Хвилі',
    'Cimática 3D': '3D Кіматика',
    'Espiral Holográfico': 'Голографічна спіраль',
    'Añadir Frecuencia': 'Додати частоту',
    'Pantalla Completa': 'На весь екран',
    'Reproduciendo': 'Відтворення',
    'Pausado': 'Пауза',
    'Ajustes': 'Налаштування',
    'Escuchar': 'Слухати',
    'Descargar': 'Завантажити',
    'Idioma': 'Мова',
  },
  el: {
    'Sensor Acústico': 'Ακουστικός Αισθητήρας',
    'Sistemas Nativos': 'Εγγενείς Εφαρμογές',
    'Inicio': 'Αρχική',
    'Librería': 'Βιβλιοθήκη',
    'Espectrómetro': 'Φασματόμετρο',
    'Comunidad': 'Κοινότητα',
    'Todas': 'Όλες',
    'Ondas 2D': 'Κύματα 2D',
    'Cimática 3D': 'Κυματική 3D',
    'Espiral Holográfico': 'Ολογραφική Σπείρα',
    'Añadir Frecuencia': 'Προσθήκη Συχνότητας',
    'Pantalla Completa': 'Πλήρης Οθόνη',
    'Reproduciendo': 'Αναπαραγωγή',
    'Pausado': 'Παύση',
    'Ajustes': 'Ρυθμίσεις',
    'Escuchar': 'Ακρόαση',
    'Descargar': 'Λήψη',
    'Idioma': 'Γλώσσα',
  },
  he: {
    'Sensor Acústico': 'חיישן אקוסטי',
    'Sistemas Nativos': 'יישומים מקומיים',
    'Inicio': 'בית',
    'Librería': 'ספרייה',
    'Espectrómetro': 'ספקטרומטר',
    'Comunidad': 'קהילה',
    'Todas': 'הכול',
    'Ondas 2D': 'גלי 2D',
    'Cimática 3D': 'סימטיקה 3D',
    'Espiral Holográfico': 'ספירלה הולוגרפית',
    'Añadir Frecuencia': 'הוסף תדר',
    'Pantalla Completa': 'מסך מלא',
    'Reproduciendo': 'מנגן',
    'Pausado': 'מושהה',
    'Ajustes': 'הגדרות',
    'Escuchar': 'האזן',
    'Descargar': 'הורדה',
    'Idioma': 'שפה',
  },
  sv: {
    'Sensor Acústico': 'Akustisk Sensor',
    'Sistemas Nativos': 'Inbyggda Appar',
    'Inicio': 'Hem',
    'Librería': 'Bibliotek',
    'Espectrómetro': 'Spektrometer',
    'Comunidad': 'Gemenskap',
    'Todas': 'Alla',
    'Ondas 2D': '2D-Vågor',
    'Cimática 3D': '3D-Kymatik',
    'Espiral Holográfico': 'Holografisk Spiral',
    'Añadir Frecuencia': 'Lägg till Frekvens',
    'Pantalla Completa': 'Helskärm',
    'Reproduciendo': 'Spelar',
    'Pausado': 'Pausad',
    'Ajustes': 'Inställningar',
    'Escuchar': 'Lyssna',
    'Descargar': 'Ladda ner',
    'Idioma': 'Språk',
  },
  cs: {
    'Sensor Acústico': 'Akustický Senzor',
    'Sistemas Nativos': 'Nativní Systémy',
    'Inicio': 'Úvod',
    'Librería': 'Knihovna',
    'Espectrómetro': 'Spektrometr',
    'Comunidad': 'Komunita',
    'Todas': 'Vše',
    'Ondas 2D': '2D Vlny',
    'Cimática 3D': '3D Kymatika',
    'Espiral Holográfico': 'Holografická Spirála',
    'Añadir Frecuencia': 'Přidat Frekvenci',
    'Pantalla Completa': 'Celá obrazovka',
    'Reproduciendo': 'Přehrávání',
    'Pausado': 'Pozastaveno',
    'Ajustes': 'Nastavení',
    'Escuchar': 'Poslouchat',
    'Descargar': 'Stáhnout',
    'Idioma': 'Jazyk',
  },
  ro: {
    'Sensor Acústico': 'Senzor Acustic',
    'Sistemas Nativos': 'Sisteme Native',
    'Inicio': 'Acasă',
    'Librería': 'Bibliotecă',
    'Espectrómetro': 'Spectrometru',
    'Comunidad': 'Comunitate',
    'Todas': 'Toate',
    'Ondas 2D': 'Unde 2D',
    'Cimática 3D': 'Cimatică 3D',
    'Espiral Holográfico': 'Spirală Holografică',
    'Añadir Frecuencia': 'Adaugă Frecvență',
    'Pantalla Completa': 'Ecran complet',
    'Reproduciendo': 'Redare',
    'Pausado': 'În pauză',
    'Ajustes': 'Setări',
    'Escuchar': 'Ascultă',
    'Descargar': 'Descarcă',
    'Idioma': 'Limbă',
  },
  hu: {
    'Sensor Acústico': 'Akusztikus Szenzor',
    'Sistemas Nativos': 'Natív Rendszerek',
    'Inicio': 'Kezdőlap',
    'Librería': 'Könyvtár',
    'Espectrómetro': 'Spektrométer',
    'Comunidad': 'Közösség',
    'Todas': 'Mind',
    'Ondas 2D': '2D Hullámok',
    'Cimática 3D': '3D Kimatika',
    'Espiral Holográfico': 'Holografikus Spirál',
    'Añadir Frecuencia': 'Frekvencia Hozzáadása',
    'Pantalla Completa': 'Teljes képernyő',
    'Reproduciendo': 'Lejátszás',
    'Pausado': 'Szüneteltetve',
    'Ajustes': 'Beállítások',
    'Escuchar': 'Meghallgatás',
    'Descargar': 'Letöltés',
    'Idioma': 'Nyelv',
  },
  fi: {
    'Sensor Acústico': 'Akustinen Anturi',
    'Sistemas Nativos': 'Natiivisovellukset',
    'Inicio': 'Etusivu',
    'Librería': 'Kirjasto',
    'Espectrómetro': 'Spektrometri',
    'Comunidad': 'Yhteisö',
    'Todas': 'Kaikki',
    'Ondas 2D': '2D-Aallot',
    'Cimática 3D': '3D-Kymatiikka',
    'Espiral Holográfico': 'Holografinen Spiraali',
    'Añadir Frecuencia': 'Lisää Taajuus',
    'Pantalla Completa': 'Koko näyttö',
    'Reproduciendo': 'Toistetaan',
    'Pausado': 'Tauolla',
    'Ajustes': 'Asetukset',
    'Escuchar': 'Kuuntele',
    'Descargar': 'Lataa',
    'Idioma': 'Kieli',
  },
  da: {
    'Sensor Acústico': 'Akustisk Sensor',
    'Sistemas Nativos': 'Native Programmer',
    'Inicio': 'Hjem',
    'Librería': 'Bibliotek',
    'Espectrómetro': 'Spektrometer',
    'Comunidad': 'Fællesskab',
    'Todas': 'Alle',
    'Ondas 2D': '2D-Bølger',
    'Cimática 3D': '3D-Cymatik',
    'Espiral Holográfico': 'Holografisk Spiral',
    'Añadir Frecuencia': 'Tilføj Frekvens',
    'Pantalla Completa': 'Fuld skærm',
    'Reproduciendo': 'Afspiller',
    'Pausado': 'Pauset',
    'Ajustes': 'Indstillinger',
    'Escuchar': 'Lyt',
    'Descargar': 'Download',
    'Idioma': 'Sprog',
  },
  no: {
    'Sensor Acústico': 'Akustisk Sensor',
    'Sistemas Nativos': 'Native Apper',
    'Inicio': 'Hjem',
    'Librería': 'Bibliotek',
    'Espectrómetro': 'Spektrometer',
    'Comunidad': 'Fellesskap',
    'Todas': 'Alle',
    'Ondas 2D': '2D-Bølger',
    'Cimática 3D': '3D-Kymatikk',
    'Espiral Holográfico': 'Holografisk Spiral',
    'Añadir Frecuencia': 'Legg til Frekvens',
    'Pantalla Completa': 'Fullskjerm',
    'Reproduciendo': 'Spiller',
    'Pausado': 'Pauset',
    'Ajustes': 'Innstillinger',
    'Escuchar': 'Lytt',
    'Descargar': 'Last ned',
    'Idioma': 'Språk',
  },
  ca: {
    'Sensor Acústico': 'Sensor Acústic',
    'Sistemas Nativos': 'Sistemes Natius',
    'Inicio': 'Inici',
    'Librería': 'Llibreria',
    'Espectrómetro': 'Espectròmetre',
    'Comunidad': 'Comunitat',
    'Todas': 'Totes',
    'Ondas 2D': 'Ones 2D',
    'Cimática 3D': 'Cimàtica 3D',
    'Espiral Holográfico': 'Espiral Hologràfica',
    'Guardar Preset': 'Desar Preset',
    'Cargar Preset': 'Carregar Preset',
    'Añadir Frecuencia': 'Afegir Freqüència',
    'Pantalla Completa': 'Pantalla Completa',
    'Reproduciendo': 'Reproduint',
    'Pausado': 'Pausat',
    'Ajustes': 'Ajustos',
    'Escuchar': 'Escoltar',
    'Descargar': 'Descarregar',
    'Idioma': 'Idioma',
  },
  sw: {
    'Sensor Acústico': 'Kihisi Sauti',
    'Sistemas Nativos': 'Programu Asili',
    'Inicio': 'Mwanzo',
    'Librería': 'Maktaba',
    'Espectrómetro': 'Spektrometa',
    'Comunidad': 'Jumuiya',
    'Todas': 'Zote',
    'Ondas 2D': 'Mawimbi 2D',
    'Cimática 3D': 'Simatiki 3D',
    'Espiral Holográfico': 'Mzunguko 3D',
    'Añadir Frecuencia': 'Ongeza Masafa',
    'Pantalla Completa': 'Skrini Kamili',
    'Reproduciendo': 'Inacheza',
    'Pausado': 'Imesitishwa',
    'Ajustes': 'Mipangilio',
    'Escuchar': 'Sikiliza',
    'Descargar': 'Pakua',
    'Idioma': 'Lugha',
  },
};

// Dynamic phrase templates preserving live frequencies, counts, and ratios cleanly
function translateDynamicPattern(trimmed: string, lang: LangCode): string | null {
  const d = LANG_DICTS[lang];
  const en = LANG_DICTS.en!;
  if (!d && lang !== 'en') return translateDynamicPattern(trimmed, 'en');

  let m = trimmed.match(/^(\d+)\s+Frecuencias$/i);
  if (m) {
    const word: Partial<Record<LangCode, string>> = {
      en: 'Frequencies', pt: 'Frequências', fr: 'Fréquences', de: 'Frequenzen',
      it: 'Frequenze', zh: '个频率', ja: '周波数', ko: '주파수', ru: 'частот',
      ar: 'ترددات', hi: 'आवृत्तियाँ', tr: 'Frekans', pl: 'Częstotliwości',
      nl: 'Frequenties', ca: 'Freqüències',
    };
    return `${m[1]} ${word[lang] || 'Frequencies'}`;
  }

  m = trimmed.match(/^(\d+)\s+Partículas$/i);
  if (m) return `${m[1]} ${d?.['Partículas'] || en['Partículas']}`;

  m = trimmed.match(/^(\d+)\s+Osciladores$/i);
  if (m) {
    const word: Partial<Record<LangCode, string>> = {
      en: 'Oscillators', pt: 'Osciladores', fr: 'Oscillateurs', de: 'Oszillatoren',
      it: 'Oscillatori', zh: '个振荡器', ja: 'オシレータ', ko: '발진기', ru: 'осцилл.',
      ar: 'مذبذبات', hi: 'दोलक', ca: 'Oscil·ladors',
    };
    return `${m[1]} ${word[lang] || 'Oscillators'}`;
  }

  m = trimmed.match(/^(\d+)\s+Frecuencias combinadas$/i);
  if (m) {
    const tpl: Partial<Record<LangCode, string>> = {
      en: `${m[1]} Combined Frequencies`,
      pt: `${m[1]} Frequências Combinadas`,
      fr: `${m[1]} Fréquences Combinées`,
      de: `${m[1]} Kombinierte Frequenzen`,
      it: `${m[1]} Frequenze Combinate`,
      zh: `${m[1]} 个合成频率`,
      ja: `${m[1]} 複合周波数`,
      ko: `${m[1]} 결합 주파수`,
      ru: `${m[1]} сочет. частот`,
      ar: `${m[1]} ترددات مدمجة`,
      hi: `${m[1]} संयुक्त आवृत्तियाँ`,
    };
    return tpl[lang] || `${m[1]} Combined Frequencies`;
  }

  m = trimmed.match(/^Sintonizar Frecuencia\s*·\s*(.+)$/i);
  if (m) {
    const verb: Partial<Record<LangCode, string>> = {
      en: 'Tune Frequency', pt: 'Sintonizar Frequência', fr: 'Syntoniser Fréquence',
      de: 'Frequenz abstimmen', it: 'Sintonizza Frequenza', zh: '调谐频率',
      ja: '周波数を同調', ko: '주파수 조율', ru: 'Настроить частоту',
      ar: 'ضبط التردد', hi: 'आवृत्ति ट्यून करें',
    };
    return `${verb[lang] || 'Tune Frequency'} · ${m[1]}`;
  }

  m = trimmed.match(/^Captación\s*·\s*(.+)$/i);
  if (m) {
    const cap: Partial<Record<LangCode, string>> = {
      en: 'Capture', pt: 'Captação', fr: 'Capture', de: 'Erfassung',
      it: 'Acquisizione', zh: '采集', ja: '計測', ko: '포착', ru: 'Захват',
      ar: 'التقاط', hi: 'कैप्चर',
    };
    return `${cap[lang] || 'Capture'} · ${m[1]}`;
  }

  m = trimmed.match(/^Ajustes Globales\s*\((\d+)\)$/i);
  if (m) {
    return `${d?.['Ajustes'] || en['Ajustes']} (${m[1]})`;
  }

  m = trimmed.match(/^(Frecuencia Base|Síntesis Activa|Espectro Ambiental):\s*(.+)$/i);
  if (m) {
    const labels: Record<string, Partial<Record<LangCode, string>>> = {
      'Frecuencia Base': { en: 'Base Frequency', pt: 'Frequência Base', fr: 'Fréquence de Base', de: 'Grundfrequenz', it: 'Frequenza Base', zh: '基准频率', ja: '基準周波数', ko: '기준 주파수', ru: 'Базовая частота', ar: 'التردد الأساسي', hi: 'आधार आवृत्ति' },
      'Síntesis Activa': { en: 'Active Synthesis', pt: 'Síntese Ativa', fr: 'Synthèse Active', de: 'Aktive Synthese', it: 'Sintesi Attiva', zh: '激活合成', ja: 'アクティブ合成', ko: '활성 합성', ru: 'Активный синтез', ar: 'التخليق النشط', hi: 'सक्रिय संश्लेषण' },
      'Espectro Ambiental': { en: 'Ambient Spectrum', pt: 'Espectro Ambiental', fr: 'Spectre Ambiant', de: 'Umgebungsspektrum', it: 'Spettro Ambientale', zh: '环境频谱', ja: '環境スペクトル', ko: '주변 스펙트럼', ru: 'Внешний спектр', ar: 'الطيف المحيط', hi: 'परिवेश स्पेक्ट्रम' },
    };
    const key = Object.keys(labels).find((k) => k.toLowerCase() === m![1].toLowerCase()) || m[1];
    return `${labels[key]?.[lang] || labels[key]?.en || m[1]}: ${m[2]}`;
  }

  return null;
}

// Fast cached lookup for any text node or attribute
const translateCache = new Map<string, string>();

export function translateUiString(raw: string, lang: LangCode): string {
  if (lang === 'es' || !raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed || /^[\d\s.,:%+\-–—/×÷φΔf()[\]HzkMnmVAW°·]+$/.test(trimmed)) {
    return raw;
  }

  const cacheKey = `${lang}\u0000${trimmed}`;
  const cached = translateCache.get(cacheKey);
  if (cached !== undefined) {
    return raw.replace(trimmed, cached);
  }

  const langDict = LANG_DICTS[lang];
  const fallbackEn = LANG_DICTS.en!;
  let translated =
    langDict?.[trimmed] ||
    translateDynamicPattern(trimmed, lang) ||
    fallbackEn[trimmed] ||
    translateDynamicPattern(trimmed, 'en') ||
    undefined;

  if (!translated) {
    return raw;
  }

  translateCache.set(cacheKey, translated);
  return raw.replace(trimmed, translated);
}

interface TextEntry {
  orig: string;
  applied: string;
}

interface AttrEntry {
  orig: string;
  applied: string;
}

const ATTRS_TO_TRANSLATE = ['placeholder', 'title', 'aria-label'] as const;

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (el.closest('[data-no-translate="true"]')) return true;
  const tag = el.tagName;
  return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'NOSCRIPT';
}

export function useReactiveTranslation(lang: LangCode): void {
  const textMapRef = useRef(new WeakMap<Text, TextEntry>());
  const attrMapRef = useRef(new WeakMap<Element, Partial<Record<string, AttrEntry>>>());
  const langRef = useRef<LangCode>(lang);
  langRef.current = lang;

  useEffect(() => {
    const info = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
    document.documentElement.lang = info.code;

    const textMap = textMapRef.current;
    const attrMap = attrMapRef.current;
    let isApplying = false;

    const processTextNode = (node: Text, targetLang: LangCode) => {
      if (shouldSkipElement(node.parentElement)) return;
      const curVal = node.nodeValue ?? '';
      let rec = textMap.get(node);
      if (!rec) {
        rec = { orig: curVal, applied: curVal };
        textMap.set(node, rec);
      } else if (curVal !== rec.applied) {
        // React updated this node's text dynamically -> capture new Spanish source text
        rec.orig = curVal;
        rec.applied = curVal;
      }

      const desired = targetLang === 'es' ? rec.orig : translateUiString(rec.orig, targetLang);
      if (curVal !== desired) {
        rec.applied = desired;
        node.nodeValue = desired;
      } else {
        rec.applied = desired;
      }
    };

    const processAttributes = (el: Element, targetLang: LangCode) => {
      if (shouldSkipElement(el)) return;
      let attrs = attrMap.get(el);
      if (!attrs) {
        attrs = {};
        attrMap.set(el, attrs);
      }
      for (const attr of ATTRS_TO_TRANSLATE) {
        const curAttr = el.getAttribute(attr);
        if (curAttr === null) continue;
        let rec = attrs[attr];
        if (!rec) {
          rec = { orig: curAttr, applied: curAttr };
          attrs[attr] = rec;
        } else if (curAttr !== rec.applied) {
          rec.orig = curAttr;
          rec.applied = curAttr;
        }

        const desired = targetLang === 'es' ? rec.orig : translateUiString(rec.orig, targetLang);
        if (curAttr !== desired) {
          rec.applied = desired;
          el.setAttribute(attr, desired);
        } else {
          rec.applied = desired;
        }
      }
    };

    const walkSubtree = (root: Node, targetLang: LangCode) => {
      if (root.nodeType === Node.TEXT_NODE) {
        processTextNode(root as Text, targetLang);
        return;
      }
      if (root.nodeType === Node.ELEMENT_NODE) {
        const el = root as Element;
        if (shouldSkipElement(el)) return;
        processAttributes(el, targetLang);
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let n: Node | null = walker.currentNode;
        while (n) {
          if (n.nodeType === Node.TEXT_NODE) {
            processTextNode(n as Text, targetLang);
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            const childEl = n as Element;
            if (!shouldSkipElement(childEl)) {
              processAttributes(childEl, targetLang);
            }
          }
          n = walker.nextNode();
        }
      }
    };

    const applyAll = () => {
      if (isApplying || !document.body) return;
      isApplying = true;
      try {
        walkSubtree(document.body, langRef.current);
      } finally {
        isApplying = false;
      }
    };

    applyAll();

    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      isApplying = true;
      try {
        const currentLang = langRef.current;
        for (const mut of mutations) {
          if (mut.type === 'characterData') {
            processTextNode(mut.target as Text, currentLang);
          } else if (mut.type === 'attributes' && mut.target.nodeType === Node.ELEMENT_NODE) {
            processAttributes(mut.target as Element, currentLang);
          } else if (mut.type === 'childList') {
            mut.addedNodes.forEach((added) => walkSubtree(added, currentLang));
          }
        }
      } finally {
        isApplying = false;
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS_TO_TRANSLATE],
    });

    return () => observer.disconnect();
  }, [lang]);
}
