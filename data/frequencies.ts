import {
  CategoryId,
  FrequencyItem,
  OscillatorState,
  TechnicalRecommendation,
  WaveType
} from '../types';
import {
  autoSuggestTechnicalRecommendation,
  computeAcousticWavelengths,
  computeOpticalOctaveNm,
  digitalRoot
} from '../utils/frequencyAnalysis';

const CATEGORY_COLORS: Record<CategoryId, string> = {
  all: '#cbd5e1',
  solfeggio: '#c084fc',
  planetary: '#22d3ee',
  nature: '#34d399',
  body: '#f87171',
  bioresonance: '#fb923c',
  electromagnetic: '#38bdf8',
  brain: '#f472b6',
  numerology: '#fcd34d',
  pyramid: '#f59e0b',
  chakras: '#facc15',
  rhythms: '#10b981',
  microtonal: '#60a5fa',
  music: '#818cf8',
  synergy: '#2dd4bf'
};

interface OscSpec {
  f: number;
  name: string;
  color: string;
  type?: WaveType;
  vol?: number;
  x?: number;
  y?: number;
  z?: number;
  ind?: boolean;
  cv?: number;
  duty?: number;
  phase?: number;
  dist?: number;
}

const osc = ({
  f,
  name,
  color,
  type = 'sine',
  vol = 0.5,
  x = 0,
  y = 0,
  z = 0,
  ind = false,
  cv,
  duty,
  phase,
  dist
}: OscSpec): Partial<OscillatorState> => ({
  frequency: f,
  type,
  volume: vol,
  panX: x,
  panY: y,
  panZ: z,
  name,
  isIndependent: ind,
  color,
  ...(cv !== undefined ? { crestValleyRatio: cv } : {}),
  ...(duty !== undefined ? { dutyCycle: duty } : {}),
  ...(phase !== undefined ? { phaseOffset: phase } : {}),
  ...(dist !== undefined ? { harmonicDistortion: dist } : {})
});

type RawFrequencyItem = Omit<FrequencyItem, 'technicalRecommendation'> & {
  technicalRecommendation?: Partial<TechnicalRecommendation>;
};

const formatHzLabel = (item: RawFrequencyItem, oscs: Partial<OscillatorState>[]): string => {
  const freqs = oscs
    .map(o => o.frequency)
    .filter((f): f is number => typeof f === 'number' && f > 0);
  if (freqs.length > 1) {
    return `${freqs.slice(0, 6).map(f => Number(f.toFixed(3))).join(' + ')} Hz`;
  }
  return `${item.numericalHz} Hz`;
};

const buildTechnicalRecommendation = (
  item: RawFrequencyItem,
  oscillators: Partial<OscillatorState>[]
): TechnicalRecommendation => {
  const base = autoSuggestTechnicalRecommendation(oscillators, item.category, item.name);
  const safeHz = Math.max(0.001, item.numericalHz || oscillators[0]?.frequency || 432);
  const phys = computeAcousticWavelengths(safeHz);
  const optics = computeOpticalOctaveNm(Math.max(0.1, safeHz));
  const custom = item.technicalRecommendation || {};

  return {
    ...base,
    ...custom,
    recommendedMediums: custom.recommendedMediums && custom.recommendedMediums.length > 0
      ? custom.recommendedMediums
      : base.recommendedMediums,
    frequencyScales: {
      hz: custom.frequencyScales?.hz || formatHzLabel(item, oscillators),
      khz: custom.frequencyScales?.khz || phys.khzOctave,
      mhz: custom.frequencyScales?.mhz || phys.mhzHarmonic,
      opticalNm: custom.frequencyScales?.opticalNm || `${optics.nm} nm (${optics.band})`
    },
    numerologyRelation: custom.numerologyRelation ||
      `Raíz teosófica ${digitalRoot(safeHz)} · Octava ${optics.band} (${optics.nm} nm)`,
    harmonicEquation: custom.harmonicEquation || base.harmonicEquation,
    naturalObjectResonance: custom.naturalObjectResonance || base.naturalObjectResonance
  };
};

const completeParticle = (raw: RawFrequencyItem): FrequencyItem => {
  const fallbackColor = CATEGORY_COLORS[raw.category] || '#38bdf8';
  const oscillatorsConfig = raw.oscillatorsConfig && raw.oscillatorsConfig.length > 0
    ? raw.oscillatorsConfig
    : [
        osc({
          f: raw.numericalHz || 432,
          name: raw.name,
          color: fallbackColor,
          ind: raw.numericalHz < 20
        })
      ];

  const primary = oscillatorsConfig[0]?.frequency || raw.numericalHz || 432;
  const harmonics = raw.harmonics && raw.harmonics.length > 0
    ? raw.harmonics
    : [
        Number((primary * 1.5).toFixed(2)),
        Number((primary * 2).toFixed(2)),
        Number((primary * 3).toFixed(2))
      ];

  return {
    ...raw,
    oscillatorsConfig,
    harmonics,
    cymaticPatternName: raw.cymaticPatternName || `Mandala Nodal ${raw.hz} Hz`,
    technicalRecommendation: buildTechnicalRecommendation(raw, oscillatorsConfig)
  };
};

const rawFrequencyData: RawFrequencyItem[] = [
  // =========================================================================
  // 1. SOLFEGGIO & ARMÓNICOS (13 partículas)
  // =========================================================================
  {
    id: 'solf_63',
    hz: '63',
    numericalHz: 63,
    name: 'Sub-Solfeggio Infra-Raíz (Si1)',
    category: 'solfeggio',
    description: 'Sub-armónico 3-6-9 de arraigo pélvico y descompresión lumbar.',
    detailedUsage: 'Suma teosófica 6+3=9. Proporciona una base vibroacústica profunda previa al 174 Hz, ideal para anclar el sistema parasimpático mediante subgraves o transductores táctiles.',
    evidence: 'Matemática Teosófica 3-6-9 / Escala Solfeggio Extendida',
    harmonics: [126, 189, 252, 378],
    cymaticPatternName: 'Hexágono Pélvico Basal',
    oscillatorsConfig: [
      osc({ f: 63, name: 'Sub-Solfeggio 63 Hz', color: '#a855f7', vol: 0.6 }),
      osc({ f: 126, name: 'Octava 126 Hz', color: '#c084fc', vol: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Subwoofer / Transductor Vibroacústico + Bobina',
      usageMode: 'Excelente en transductor táctil lumbar o subwoofer a volumen moderado; también útil en bobina magnética de baja frecuencia.',
      recommendedVolume: '40% - 60% (~58 dB)',
      recommendedVoltage: '4 V - 12 V DC',
      recommendedAmperage: '200 mA - 700 mA',
      recommendedWatts: '3 W - 10 W',
      recommendedDuration: '20 - 35 min',
      numerologyRelation: '6 + 3 = 9 (Cierre de ciclo Vórtex) · 63 × 2 = 126 Hz (Sol)',
      harmonicEquation: 'f₀ = 7 × 9 Hz = 63 Hz · 4f₀ = 252 Hz (Cercano a Do4)',
      naturalObjectResonance: 'Cavidad pélvica, sacro y resonancia grave de tambores ceremoniales'
    }
  },
  {
    id: 'solf_174',
    hz: '174',
    numericalHz: 174,
    name: 'Fa3 - El Anestésico Cuántico',
    category: 'solfeggio',
    description: 'Seguridad, arraigo y alivio fisiológico del dolor.',
    detailedUsage: 'Constituye el cimiento del espectro Solfeggio. Actúa sobre el sistema nervioso central inhibiendo señales nociceptivas y estabilizando el campo energético bioeléctrico. Suma Teosófica: 12 → 3.',
    evidence: 'Dr. Joseph Puleo / Dr. Leonard Horowitz',
    harmonics: [348, 522, 696, 870],
    cymaticPatternName: 'Tríada Triangular Estacionaria (N=3)',
    oscillatorsConfig: [
      osc({ f: 174, name: 'Solfeggio 174 Hz', color: '#c084fc', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Ambiental / Transductor Somático',
      usageMode: 'Ideal como sonido de fondo suave en altavoces o transductor corporal sobre zonas de tensión muscular; compatible con PEMF de alivio.',
      recommendedVolume: '30% - 50% (~52 dB)',
      recommendedVoltage: '2 V - 9 V RMS/DC',
      recommendedAmperage: '100 mA - 450 mA',
      recommendedWatts: '1 W - 6 W',
      recommendedDuration: '25 - 45 min',
      numerologyRelation: '1 + 7 + 4 = 12 → 3 (Estructura trinitaria basal)',
      harmonicEquation: 'f₀ = 174 Hz · 174 + 111 = 285 Hz (Paso constante Solfeggio Δ=111 Hz)',
      naturalObjectResonance: 'Fascia muscular profunda, médula espinal y cavidades óseas'
    }
  },
  {
    id: 'solf_285',
    hz: '285',
    numericalHz: 285,
    name: 'Do#4 - Restauración Tisular',
    category: 'solfeggio',
    description: 'Regeneración de tejidos y matriz etérica.',
    detailedUsage: 'Envía un patrón armónico para recordar a la matriz celular su estado saludable original. Acelera cicatrización y regeneración de órganos. Suma Teosófica: 15 → 6.',
    evidence: 'Dr. Joseph Puleo',
    harmonics: [570, 855, 1140, 1425],
    cymaticPatternName: 'Roseta Hexagonal Celular (N=6)',
    oscillatorsConfig: [
      osc({ f: 285, name: 'Solfeggio 285 Hz', color: '#c084fc', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_nir', 'electromagnetica'],
      primaryMediumLabel: 'Acústica de Fondo + Modulación NIR Tisular',
      usageMode: 'Funciona como audio ambiental relajante o modulando paneles de luz roja/infrarroja 660–810 nm sobre tejido lesionado.',
      recommendedVolume: '30% - 45% (~50 dB)',
      recommendedVoltage: '3.3 V - 12 V DC',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '2 + 8 + 5 = 15 → 6 (Armonía matricial)',
      harmonicEquation: 'f = 174 + 111 = 285 Hz · λ_agua = 5.19 m',
      naturalObjectResonance: 'Matriz extracelular, colágeno y agua intersticial'
    }
  },
  {
    id: 'solf_396',
    hz: '396',
    numericalHz: 396,
    name: 'UT - Liberación (Sol4)',
    category: 'solfeggio',
    description: 'Chakra Raíz: Liberación de culpa y miedo.',
    detailedUsage: 'Desintegra patrones subconscientes de culpa, fobias y traumas pasados. Fortalece los cimientos psíquicos y eleva la resiliencia. Suma Teosófica: 18 → 9.',
    evidence: 'Dr. Joseph Puleo',
    harmonics: [198, 792, 1188, 1584],
    cymaticPatternName: 'Estrella Nonagonal (9 Puntas)',
    oscillatorsConfig: [
      osc({ f: 396, name: 'UT Solfeggio 396 Hz', color: '#c084fc', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental / Voz y Meditación',
      usageMode: 'Reproducción acústica limpia como sonido de fondo meditativo o apoyo a respiración diafragmática.',
      recommendedVolume: '25% - 45% (~48–55 dB)',
      recommendedVoltage: '1.5 V - 5 V RMS',
      recommendedAmperage: '60 mA - 250 mA',
      recommendedWatts: '0.8 W - 4 W',
      recommendedDuration: '20 - 30 min',
      numerologyRelation: '3 + 9 + 6 = 18 → 9 (Permutación directa Vórtex 3-6-9)',
      harmonicEquation: 'f = 285 + 111 = 396 Hz = 9 × 44 Hz',
      naturalObjectResonance: 'Plexo sacro, glándulas suprarrenales y cuencos tibetanos medianos'
    }
  },
  {
    id: 'solf_417',
    hz: '417',
    numericalHz: 417,
    name: 'RE - Transmutación (Sol#4)',
    category: 'solfeggio',
    description: 'Chakra Sacro: Facilitación del cambio y creatividad.',
    detailedUsage: 'Limpia bloqueos creativos y memorias traumáticas acumuladas en el cuerpo etérico. Proporciona una reserva inagotable de energía renovadora. Suma Teosófica: 12 → 3.',
    evidence: 'Dr. Joseph Puleo',
    harmonics: [208.5, 834, 1251, 1668],
    cymaticPatternName: 'Trisquel Dinámico Rotacional',
    oscillatorsConfig: [
      osc({ f: 417, name: 'RE Solfeggio 417 Hz', color: '#c084fc', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Estéreo / Campo Creativo',
      usageMode: 'Ideal como sonido ambiental suave durante escritura, arte o terapia somática.',
      recommendedVolume: '25% - 45% (~50 dB)',
      recommendedVoltage: '1.5 V - 5 V RMS',
      recommendedAmperage: '60 mA - 250 mA',
      recommendedWatts: '0.8 W - 4 W',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '4 + 1 + 7 = 12 → 3 (Catalizador de movimiento)',
      harmonicEquation: 'f = 417 Hz · 417 + 111 = 528 Hz (Diferencia exacta 111 Hz)',
      naturalObjectResonance: 'Líquidos sinoviales, agua celular y vórtices fluídicos'
    }
  },
  {
    id: 'solf_528',
    hz: '528',
    numericalHz: 528,
    name: 'MI - Frecuencia Milagrosa (Do5)',
    category: 'solfeggio',
    description: 'Plexo Solar/Corazón: Reparación biológica de ADN y Amor Universal.',
    detailedUsage: 'Frecuencia central del espectro Solfeggio. Ligada al color verde clorofila (516 nm en la 40ª octava), la coherencia del agua estructurada y la restauración cromosómica. Suma Teosófica: 15 → 6.',
    evidence: 'Dr. Lee Lorenzen / Dr. Leonard Horowitz',
    harmonics: [264, 1056, 1584, 2112],
    cymaticPatternName: 'Flor de la Vida Hexagonal (6 Pétalos)',
    oscillatorsConfig: [
      osc({ f: 528, name: 'MI Solfeggio 528 Hz', color: '#4ade80', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_uv', 'multimedio'],
      primaryMediumLabel: 'Acústica Armónica + Cromoterapia Verde 516 nm',
      usageMode: 'Altamente versátil: funciona como sonido ambiental o mediante altavoz cercano a recipientes de agua viva; su 40ª octava óptica cae en 516 nm (verde clorofila).',
      recommendedVolume: '30% - 50% (~52 dB)',
      recommendedVoltage: '2 V - 9 V RMS/DC',
      recommendedAmperage: '80 mA - 350 mA',
      recommendedWatts: '1 W - 5 W',
      recommendedDuration: '30 - 60 min',
      numerologyRelation: '5 + 2 + 8 = 15 → 6 · En clave A=444 Hz es exactamente Do5',
      harmonicEquation: '528 × 2⁴⁰ Hz = 5.805 × 10¹⁴ Hz → λ = 516.4 nm (Verde Esmeralda)',
      naturalObjectResonance: 'Clorofila vegetal, agua hexagonal H₃O₂⁻ y doble hélice de ADN'
    }
  },
  {
    id: 'solf_639',
    hz: '639',
    numericalHz: 639,
    name: 'FA - Red Integradora (Mi5)',
    category: 'solfeggio',
    description: 'Chakra Corazón: Armonía relacional y unificación.',
    detailedUsage: 'Fomenta la comunicación intercelular y el entendimiento en relaciones interpersonales. Equilibra hemisferios cerebrales y disuelve el aislamiento. Suma Teosófica: 18 → 9.',
    evidence: 'Dr. Joseph Puleo',
    harmonics: [319.5, 1278, 1917, 2556],
    cymaticPatternName: 'Mandala Cardíaco de 9 Lóbulos',
    oscillatorsConfig: [
      osc({ f: 639, name: 'FA Solfeggio 639 Hz', color: '#c084fc', vol: 0.45 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental / Altavoces Estéreo',
      usageMode: 'Ideal para ambientación grupal, sesiones compartidas y coherencia empática a volumen moderado.',
      recommendedVolume: '25% - 45% (~50 dB)',
      recommendedVoltage: '1.5 V - 5 V RMS',
      recommendedAmperage: '60 mA - 220 mA',
      recommendedWatts: '0.8 W - 3.5 W',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: '6 + 3 + 9 = 18 → 9 (Permutación especular de 369 y 963)',
      harmonicEquation: 'f = 528 + 111 = 639 Hz · 639 / 396 = 1.6136 ≈ φ',
      naturalObjectResonance: 'Campo toroidal cardíaco y sinapsis interhemisféricas'
    }
  },
  {
    id: 'solf_741',
    hz: '741',
    numericalHz: 741,
    name: 'SOL - Limpiador del Espectro (Fa#5)',
    category: 'solfeggio',
    description: 'Chakra Garganta: Desintoxicación celular y voz superior.',
    detailedUsage: 'Ayuda a disipar la fatiga por contaminación electromagnética y carga toxicológica celular. Clarifica la expresión vocal y la glándula tiroides. Suma Teosófica: 12 → 3.',
    evidence: 'Dr. Joseph Puleo',
    harmonics: [370.5, 1482, 2223, 2964],
    cymaticPatternName: 'Estrella Hexagonal de Purificación',
    oscillatorsConfig: [
      osc({ f: 741, name: 'SOL Solfeggio 741 Hz', color: '#c084fc', vol: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Clara / Emisión PEMF Limpiadora',
      usageMode: 'Adecuada como audio de limpieza ambiental por bloques de 15–25 min o en bobina PEMF para restablecer coherencia bioeléctrica.',
      recommendedVolume: '20% - 40% (~48 dB)',
      recommendedVoltage: '2 V - 12 V',
      recommendedAmperage: '100 mA - 400 mA',
      recommendedWatts: '1 W - 5 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '7 + 4 + 1 = 12 → 3 (Ordenamiento expresivo)',
      harmonicEquation: 'f = 741 Hz = 3 × 13 × 19 Hz · 741 + 111 = 852 Hz',
      naturalObjectResonance: 'Laringe, tiroides y agua intracelular'
    }
  },
  {
    id: 'solf_852',
    hz: '852',
    numericalHz: 852,
    name: 'LA - Despertar de la Intuición (La5)',
    category: 'solfeggio',
    description: 'Tercer Ojo: Apertura de la percepción espiritual.',
    detailedUsage: 'Restaura el orden espiritual disolviendo el ruido cognitivo. Eleva la percepción extrasensorial y la visión holográfica. Suma Teosófica: 15 → 6.',
    evidence: 'Dr. Joseph Puleo',
    harmonics: [426, 1704, 2556, 3408],
    cymaticPatternName: 'Loto Frontal de 12 Pétalos',
    oscillatorsConfig: [
      osc({ f: 852, name: 'LA Solfeggio 852 Hz', color: '#c084fc', vol: 0.38 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_uv'],
      primaryMediumLabel: 'Acústica Meditativa / Cromoterapia Índigo',
      usageMode: 'Usar a volumen suave en auriculares o campo cercano durante meditación visual y contemplación silenciosa.',
      recommendedVolume: '20% - 38% (~45 dB)',
      recommendedVoltage: '1.2 V - 4.5 V',
      recommendedAmperage: '50 mA - 200 mA',
      recommendedWatts: '0.5 W - 3 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '8 + 5 + 2 = 15 → 6 (Armonía intuitiva)',
      harmonicEquation: 'f = 852 Hz = 2 × 426 Hz (Octava cercana al La4 Védico 426.66 Hz)',
      naturalObjectResonance: 'Cortex prefrontal, glándula pituitaria y nervio óptico'
    }
  },
  {
    id: 'solf_963',
    hz: '963',
    numericalHz: 963,
    name: 'SI - Frecuencia de los Dioses (Si5)',
    category: 'solfeggio',
    description: 'Chakra Corona: Conexión con la Conciencia Universal.',
    detailedUsage: 'Activa la glándula pineal y sincroniza las microcristalizaciones de calcita pineal. Reconecta el campo energético humano con el entramado cósmico. Suma Teosófica: 18 → 9.',
    evidence: 'Dr. Joseph Puleo',
    harmonics: [481.5, 1926, 2889, 3852],
    cymaticPatternName: 'Corona Concéntrica de 18 Radios',
    oscillatorsConfig: [
      osc({ f: 963, name: 'SI Solfeggio 963 Hz', color: '#e879f9', vol: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_uv', 'magnetica'],
      primaryMediumLabel: 'Acústica Sutil / Bobina Escalares Craneal',
      usageMode: 'Por su tono agudo, mantener volumen bajo-suave como armónico de meditación o emplear mediante bobina toroidal de baja intensidad.',
      recommendedVolume: '15% - 35% (~44 dB)',
      recommendedVoltage: '1.5 V - 6 V',
      recommendedAmperage: '50 mA - 220 mA',
      recommendedWatts: '0.5 W - 3 W',
      recommendedDuration: '15 - 25 min',
      numerologyRelation: '9 + 6 + 3 = 18 → 9 (Espejo de 369 y culminación Solfeggio)',
      harmonicEquation: 'f = 852 + 111 = 963 Hz = 9 × 107 Hz',
      naturalObjectResonance: 'Microcristales piezoeléctricos de calcita en la glándula pineal'
    }
  },
  {
    id: 'solf_1074',
    hz: '1074',
    numericalHz: 1074,
    name: 'Solfeggio Armónico Superior I',
    category: 'solfeggio',
    description: 'Expansión del aura y campo electromagnético toroidal.',
    detailedUsage: 'Suma Teosófica: 12 → 3. Extensión matemática +111 Hz sobre 963 Hz; actúa sobre la envoltura biofotónica periférica del cuerpo.',
    evidence: 'Investigación Neopitagórica / Escala Solfeggio Extendida',
    harmonics: [537, 2148, 3222],
    cymaticPatternName: 'Toroide Nodal de Alta Simetría',
    oscillatorsConfig: [
      osc({ f: 1074, name: 'Solfeggio Superior 1074 Hz', color: '#c084fc', vol: 0.32 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Suave / Antena PEMF Armónica',
      usageMode: 'Reproducir a volumen bajo combinado con frecuencias graves o mediante emisor PEMF/escalar de campo amplio.',
      recommendedVolume: '15% - 30% (~42 dB)',
      recommendedVoltage: '3 V - 12 V',
      recommendedAmperage: '80 mA - 300 mA',
      recommendedWatts: '1 W - 4 W',
      recommendedDuration: '10 - 20 min',
      numerologyRelation: '1 + 0 + 7 + 4 = 12 → 3 (Extensión superior de la tríada)',
      harmonicEquation: 'f = 963 + 111 = 1074 Hz',
      naturalObjectResonance: 'Campo bioeléctrico peridérmico y diapasón de cuarzo'
    }
  },
  {
    id: 'solf_1185',
    hz: '1185',
    numericalHz: 1185,
    name: 'Solfeggio Armónico Superior II',
    category: 'solfeggio',
    description: 'Coherencia del cuerpo de luz (Merkaba).',
    detailedUsage: 'Suma Teosófica: 15 → 6. Sincronización geométrica fractal de armónicos agudos en el espacio acústico.',
    evidence: 'Geometría Sagrada / Escala Solfeggio Extendida',
    harmonics: [592.5, 2370, 3555],
    cymaticPatternName: 'Estrella Octaédrica Fractal',
    oscillatorsConfig: [
      osc({ f: 1185, name: 'Solfeggio Superior 1185 Hz', color: '#d8b4fe', vol: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_uv'],
      primaryMediumLabel: 'Acústica de Armónicos Finos / Modulación Fotónica',
      usageMode: 'Usar a bajo volumen en espacios silenciosos o como envolvente de modulación óptica violeta/UV-A suave.',
      recommendedVolume: '12% - 28% (~40 dB)',
      recommendedVoltage: '3 V - 12 V',
      recommendedAmperage: '80 mA - 300 mA',
      recommendedWatts: '1 W - 4 W',
      recommendedDuration: '10 - 20 min',
      numerologyRelation: '1 + 1 + 8 + 5 = 15 → 6',
      harmonicEquation: 'f = 1074 + 111 = 1185 Hz',
      naturalObjectResonance: 'Estructuras cristalinas de cuarzo y cámaras reverberantes'
    }
  },
  {
    id: 'solf_1296',
    hz: '1296',
    numericalHz: 1296,
    name: 'Solfeggio Corona Cuarta Potencia (6⁴)',
    category: 'solfeggio',
    description: 'Culminación Solfeggio 1296 Hz = 6⁴ = 3 × 432 Hz.',
    detailedUsage: 'Suma teosófica 1+2+9+6=18→9. Unifica exactamente la progresión Solfeggio (+111 Hz sobre 1185 Hz) con el tercer armónico perfecto de 432 Hz (3 × 432 = 1296).',
    evidence: 'Matemática Pitagórica & Solfeggio',
    harmonics: [432, 648, 864, 2592],
    cymaticPatternName: 'Dodecaedro Armónico Cristalino',
    oscillatorsConfig: [
      osc({ f: 1296, name: 'Corona 1296 Hz (6⁴)', color: '#e879f9', vol: 0.28 }),
      osc({ f: 432, name: 'Sub-Armónico 432 Hz', color: '#c084fc', vol: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Estéreo Armónica / Campo Multi-Medio',
      usageMode: 'Combinar 1296 Hz suave con su base 432 Hz como fondo de claridad mental o en sesiones de geometría sagrada.',
      recommendedVolume: '15% - 35% (~44 dB)',
      recommendedVoltage: '1.5 V - 6 V',
      recommendedAmperage: '60 mA - 250 mA',
      recommendedWatts: '0.8 W - 4 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '1296 = 6⁴ = 36² · Suma teosófica 18 → 9 · 1296 = 3 × 432',
      harmonicEquation: 'f = 1185 + 111 = 1296 Hz = 3 × 432 Hz',
      naturalObjectResonance: 'Diapasones armónicos de cristal y placas Chladni de bronce'
    }
  },

  // =========================================================================
  // 2. CÓSMICAS & PLANETARIAS (16 partículas)
  // =========================================================================
  {
    id: 'plan_schumann',
    hz: '7.83',
    numericalHz: 7.83,
    name: 'Resonancia Schumann - Latido de Gaia',
    category: 'planetary',
    description: 'Onda electromagnética fundamental de la biosfera terrestre.',
    detailedUsage: 'Cavidad resonante esférica entre la superficie terrestre y la ionosfera (λ ≈ circunferencia terrestre). Induce coherencia bioeléctrica alfa-theta, reduce cortisol y sincroniza ritmos circadianos.',
    evidence: 'W.O. Schumann (1952) / NASA / ELF Geophysics',
    location: 'Cavidad Tierra-Ionosfera Global',
    harmonics: [14.3, 20.8, 27.3, 33.8],
    cymaticPatternName: 'Onda Estacionaria Esférica Fundamental',
    oscillatorsConfig: [
      osc({ f: 7.83, name: 'Schumann 7.83 Hz (PEMF/ELF)', color: '#22d3ee', vol: 0.75, ind: true }),
      osc({ f: 136.1, name: 'Portadora OM (L)', color: '#06b6d4', vol: 0.35, x: -0.75 }),
      osc({ f: 143.93, name: 'Binaural 7.83 Hz (R)', color: '#67e8f9', vol: 0.35, x: 0.75 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica', 'acustica'],
      primaryMediumLabel: 'Bobina PEMF / Magnética + Binaural Estéreo L/R',
      usageMode: 'Al ser 7.83 Hz una onda ELF electromagnética natural, su máxima eficacia física es vía bobina PEMF/magnética o mediante el par binaural 136.10 / 143.93 Hz con audífonos estéreo.',
      recommendedVolume: '30% - 50% (Binaural) | PEMF continuo',
      recommendedVoltage: '5 V - 12 V DC (Bobina Schumann)',
      recommendedAmperage: '100 mA - 500 mA',
      recommendedWatts: '0.5 W - 5 W (Campo ~1–50 µT)',
      recommendedDuration: '30 - 90 min (Uso diario / descanso)',
      numerologyRelation: '7 + 8 + 3 = 18 → 9 · Frontera exacta Theta-Alfa (7.83 Hz)',
      harmonicEquation: 'fₙ = (c / 2πR_T) · √(n(n+1)) ≈ 7.83 Hz (n=1, R_T=6371 km)',
      naturalObjectResonance: 'Cavidad atmosférica Tierra–Ionosfera y hipocampo mamífero'
    }
  },
  {
    id: 'plan_schumann_2_3',
    hz: '14.3-20.8',
    numericalHz: 14.3,
    name: 'Armónicos Schumann II y III (14.3 & 20.8 Hz)',
    category: 'planetary',
    description: 'Modos resonantes terrestres superiores en bandas SMR y Beta.',
    detailedUsage: 'Los modos n=2 (14.3 Hz) y n=3 (20.8 Hz) de la cavidad Tierra-Ionosfera acompañan la vigilia atenta, la alerta física y el metabolismo cortical diurno.',
    evidence: 'Geofísica Ionosférica / Espectro Schumann',
    location: 'Cavidad Tierra-Ionosfera Global',
    harmonics: [7.83, 14.3, 20.8, 27.3, 33.8],
    cymaticPatternName: 'Armónicos Esféricos Multipolares (n=2,3)',
    oscillatorsConfig: [
      osc({ f: 14.3, name: 'Schumann Modo II (14.3 Hz)', color: '#22d3ee', vol: 0.6, ind: true }),
      osc({ f: 20.8, name: 'Schumann Modo III (20.8 Hz)', color: '#38bdf8', vol: 0.5, ind: true }),
      osc({ f: 256, name: 'Portadora (L)', color: '#0ea5e9', vol: 0.3, x: -0.7 }),
      osc({ f: 270.3, name: 'Batido 14.3 Hz (R)', color: '#7dd3fc', vol: 0.3, x: 0.7 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'acustica'],
      primaryMediumLabel: 'Bobina PEMF Diurna + Binaural Audífonos',
      usageMode: 'Preferible durante horas de actividad diurna vía bobina PEMF de escritorio o auriculares estéreo para enfoque lúcido.',
      recommendedVolume: '25% - 45%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '120 mA - 450 mA',
      recommendedWatts: '1 W - 5 W',
      recommendedDuration: '20 - 45 min (Mañana / Tarde)',
      numerologyRelation: 'Modos multipolares n=2 (SMR) y n=3 (Beta media)',
      harmonicEquation: 'f₂ ≈ 7.83 × √3 ≈ 14.3 Hz · f₃ ≈ 20.8 Hz',
      naturalObjectResonance: 'Descargas atmosféricas globales y ritmo sensoriomotor humano'
    }
  },
  {
    id: 'plan_sun',
    hz: '126.22',
    numericalHz: 126.22,
    name: 'Sol - Centro Vital (Si1)',
    category: 'planetary',
    description: 'Expansión de la conciencia, vitalidad y voluntad.',
    detailedUsage: 'Frecuencia de la octava cósmica solar (25.38 días sinódicos/físicos escalados por Hans Cousto). Calienta el cuerpo sutil, refuerza el plexo solar y proyecta vitalidad.',
    evidence: 'Hans Cousto - Die Kosmische Oktave',
    harmonics: [63.11, 252.44, 378.66, 504.88],
    cymaticPatternName: 'Disco Solar Radiante (Simetría Radial)',
    oscillatorsConfig: [
      osc({ f: 126.22, name: 'Sol Cousto 126.22 Hz', color: '#fbbf24', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_nir'],
      primaryMediumLabel: 'Vibroacústica Plexo Solar / Audio Ambiental',
      usageMode: 'Excelente como sonido de fondo matutino, diapasón sobre esternón/plexo o combinado con luz solar/NIR cálida.',
      recommendedVolume: '35% - 55% (~55 dB)',
      recommendedVoltage: '2 V - 6 V RMS',
      recommendedAmperage: '80 mA - 300 mA',
      recommendedWatts: '1 W - 5 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '126.22 Hz → Verde/Amarillo solar en 40ª octava óptica',
      harmonicEquation: 'f_Sol = (1 / T_rot) × 2ⁿ ≈ 126.22 Hz (Cousto)',
      naturalObjectResonance: 'Plexo solar, diafragma y cronobiología circadiana'
    }
  },
  {
    id: 'plan_earth_year',
    hz: '136.10',
    numericalHz: 136.1,
    name: 'Tierra: Año (OM) (Do#3)',
    category: 'planetary',
    description: 'Equilibrio primordial, meditación y centramiento.',
    detailedUsage: 'Frecuencia del año sidéreo terrestre (365.256 días × 2³² octavas = 136.10 Hz, Tono OM). Estándar internacional de diapasones de meditación y cantos védicos.',
    evidence: 'Hans Cousto / Tradición Védica',
    harmonics: [68.05, 272.2, 408.3, 544.4],
    cymaticPatternName: 'Yantra OM / Rosa Polar de 8 Pétalos',
    oscillatorsConfig: [
      osc({ f: 136.1, name: 'Tierra OM 136.10 Hz', color: '#22d3ee', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Meditativa / Diapasón Torácico',
      usageMode: 'Funciona de forma extraordinaria como fondo meditativo, entonación vocal OM o vibración en el centro del pecho.',
      recommendedVolume: '30% - 55% (~54 dB)',
      recommendedVoltage: '1.5 V - 5 V RMS',
      recommendedAmperage: '60 mA - 250 mA',
      recommendedWatts: '1 W - 4 W',
      recommendedDuration: '20 - 60 min',
      numerologyRelation: '1 + 3 + 6 + 1 = 11 → 2 (Polaridad armónica Tierra-Sol)',
      harmonicEquation: 'f_OM = (1 / 31,558,149 s) × 2³² = 136.10 Hz',
      naturalObjectResonance: 'Caja torácica humana, sitar hindú y órbita terrestre'
    }
  },
  {
    id: 'plan_pluto',
    hz: '140.25',
    numericalHz: 140.25,
    name: 'Plutón - La Transmutación (Do#3)',
    category: 'planetary',
    description: 'Transformación profunda y renacimiento.',
    detailedUsage: 'Período orbital plutoniano (~248 años) elevado 40 octavas. Favorece procesos de catarsis, liberación de viejos patrones y regeneración psíquica.',
    evidence: 'Hans Cousto - Cosmic Octave',
    harmonics: [70.125, 280.5, 420.75],
    cymaticPatternName: 'Vórtex Espiral Profundo',
    oscillatorsConfig: [
      osc({ f: 140.25, name: 'Plutón 140.25 Hz', color: '#818cf8', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Acústica Profunda / Trabajo Somático',
      usageMode: 'Recomendado en sesiones contemplativas silenciosas a volumen bajo-medio para introspección profunda.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f_Plutón = (1 / T_248a) × 2⁴⁰ = 140.25 Hz',
      naturalObjectResonance: 'Sistema límbico profundo y memoria somática'
    }
  },
  {
    id: 'plan_merc',
    hz: '141.27',
    numericalHz: 141.27,
    name: 'Mercurio - El Mensajero (Do#3)',
    category: 'planetary',
    description: 'Agilidad intelectual, percepción lógica y lenguaje.',
    detailedUsage: 'Sincronizado con el período sinódico/orbital de Mercurio (87.97 días × 2³⁰). Potencia el procesamiento cognitivo, la comunicación y la claridad verbal.',
    evidence: 'Hans Cousto',
    harmonics: [282.54, 423.81, 565.08],
    cymaticPatternName: 'Caduceo Ondulatorio Doble',
    oscillatorsConfig: [
      osc({ f: 141.27, name: 'Mercurio 141.27 Hz', color: '#38bdf8', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica de Fondo / Estudio y Lectura',
      usageMode: 'Ideal como sonido de fondo durante estudio, programación o redacción para fluidez lingüística.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '25 - 50 min',
      harmonicEquation: 'f_Mercurio = (1 / 7,600,521 s) × 2³⁰ = 141.27 Hz',
      naturalObjectResonance: 'Áreas corticales de Broca/Wernicke y tiroides'
    }
  },
  {
    id: 'plan_mars',
    hz: '144.72',
    numericalHz: 144.72,
    name: 'Marte - El Impulso (Re3)',
    category: 'planetary',
    description: 'Fuerza motriz, decisión y coraje.',
    detailedUsage: 'Frecuencia orbital de Marte (686.98 días × 2³³). Estimula la energía física, la determinación operacional y la superación de la inercia.',
    evidence: 'Hans Cousto',
    harmonics: [72.36, 289.44, 434.16],
    cymaticPatternName: 'Cruz Tetragonal Dinámica',
    oscillatorsConfig: [
      osc({ f: 144.72, name: 'Marte 144.72 Hz', color: '#ef4444', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_nir'],
      primaryMediumLabel: 'Acústica Activa / Activación Física',
      usageMode: 'Usar por la mañana o antes de actividad física/creativa exigente; evitar justo antes de dormir.',
      recommendedVolume: '35% - 55%',
      recommendedDuration: '15 - 25 min',
      harmonicEquation: 'f_Marte = (1 / T_687d) × 2³³ = 144.72 Hz',
      naturalObjectResonance: 'Tono muscular estriado y respuesta simpática equilibrada'
    }
  },
  {
    id: 'plan_saturn',
    hz: '147.85',
    numericalHz: 147.85,
    name: 'Saturno - Eje de Estructura (Re#3)',
    category: 'planetary',
    description: 'Disciplina, cristalización y concentración.',
    detailedUsage: 'Frecuencia del período orbital saturniano (29.46 años × 2³⁷). Ayuda a definir límites saludables, consolidar proyectos y estabilizar la mente.',
    evidence: 'Hans Cousto',
    harmonics: [73.925, 295.7, 443.55],
    cymaticPatternName: 'Hexágono Polar Saturniano',
    oscillatorsConfig: [
      osc({ f: 147.85, name: 'Saturno 147.85 Hz', color: '#94a3b8', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Acústica Estructural / Concentración Profunda',
      usageMode: 'Ideal como tono base estable durante trabajo estructurado o prácticas de postura y columna vertebral.',
      recommendedVolume: '30% - 45%',
      recommendedDuration: '25 - 45 min',
      harmonicEquation: 'f_Saturno = (1 / T_29.46a) × 2³⁷ = 147.85 Hz',
      naturalObjectResonance: 'Tormenta hexagonal polar de Saturno y sistema óseo'
    }
  },
  {
    id: 'plan_platonic_year',
    hz: '172.06',
    numericalHz: 172.06,
    name: 'Año Platónico - Precesión Axial (25,920 años)',
    category: 'planetary',
    description: 'Ciclo completo de precesión de los equinoccios elevado 47 octavas.',
    detailedUsage: 'Calculado por Hans Cousto sobre el Gran Año Platónico de ~25,920 años (× 2⁴⁷ = 172.06 Hz, nota Fa3). Asociado al Chakra Corona y la claridad espiritual sin esfuerzo.',
    evidence: 'Hans Cousto - Die Kosmische Oktave',
    harmonics: [86.03, 344.12, 516.18],
    cymaticPatternName: 'Mandala Precesional de 12 Casas',
    oscillatorsConfig: [
      osc({ f: 172.06, name: 'Año Platónico 172.06 Hz', color: '#a78bfa', vol: 0.5 }),
      osc({ f: 344.12, name: 'Octava 344.12 Hz', color: '#c4b5fd', vol: 0.2 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Contemplativa / Diapasón Craneal',
      usageMode: 'Excelente como fondo silencioso de meditación prolongada o entonación vocal para serenidad mental.',
      recommendedVolume: '25% - 45% (~50 dB)',
      recommendedDuration: '25 - 45 min',
      numerologyRelation: '25,920 años = 72 × 360 · 172.06 Hz casi unísono con Solfeggio 174 Hz',
      harmonicEquation: 'f_Platónico = (1 / 8.179 × 10¹¹ s) × 2⁴⁷ = 172.06 Hz',
      naturalObjectResonance: 'Eje rotacional terrestre y glándula pineal'
    }
  },
  {
    id: 'plan_jupiter',
    hz: '183.58',
    numericalHz: 183.58,
    name: 'Júpiter - Expansión (Fa#3)',
    category: 'planetary',
    description: 'Abundancia, sabiduría y expansión de horizontes.',
    detailedUsage: 'Frecuencia del período orbital jupiteriano (11.86 años × 2³⁶). Estimula el pensamiento filosófico, la creatividad constructiva y la apertura mental.',
    evidence: 'Hans Cousto',
    harmonics: [91.79, 367.16, 550.74],
    cymaticPatternName: 'Espiral Jovial Expansiva',
    oscillatorsConfig: [
      osc({ f: 183.58, name: 'Júpiter 183.58 Hz', color: '#fb923c', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Ambiental / Expansión Creativa',
      usageMode: 'Sonido de fondo cálido para síntesis estratégica, aprendizaje filosófico o música generativa.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: 'f_Júpiter = (1 / T_11.86a) × 2³⁶ = 183.58 Hz',
      naturalObjectResonance: 'Hígado, campo expansivo y acústica de maderas nobles'
    }
  },
  {
    id: 'plan_earth_day',
    hz: '194.18',
    numericalHz: 194.18,
    name: 'Tierra: Día Sidéreo (Sol#3)',
    category: 'planetary',
    description: 'Rotación diaria de la Tierra (24 octavas sobre 86,164 s).',
    detailedUsage: 'Calculado por Hans Cousto sobre la rotación terrestre (23h 56m 4s × 2²⁴ = 194.18 Hz; día sinódico 86,400 s = 194.71 Hz). Sincroniza la energía vital diurna y el tono del Chakra Raíz.',
    evidence: 'Hans Cousto - Octava Cósmica',
    harmonics: [97.09, 388.36, 582.54],
    cymaticPatternName: 'Círculo Axial Terrestre',
    oscillatorsConfig: [
      osc({ f: 194.18, name: 'Día Sidéreo 194.18 Hz', color: '#34d399', vol: 0.5 }),
      osc({ f: 194.71, name: 'Día Solar Sinódico 194.71 Hz', color: '#22d3ee', vol: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Acústica de Arraigo / Diapasón Base Columna',
      usageMode: 'La interacción sutil 194.18 + 194.71 Hz genera un pulso de 0.53 Hz muy relajante; ideal para despertar el cuerpo y enraizar al inicio del día.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: 'Δf(Solar - Sidéreo) = 0.53 Hz (Pulso Epsilon lento)',
      harmonicEquation: 'f_Sidéreo = (1 / 86,164.1 s) × 2²⁴ = 194.18 Hz',
      naturalObjectResonance: 'Rotación terrestre, base coccígea y ciclos circadianos'
    }
  },
  {
    id: 'plan_uranus',
    hz: '207.36',
    numericalHz: 207.36,
    name: 'Urano - La Revelación (Sol#3)',
    category: 'planetary',
    description: 'Innovación, intuición cuántica y libertad.',
    detailedUsage: 'Asociada a la ruptura de paradigmas obsoletos, destellos de inspiración súbita y plasticidad sináptica.',
    evidence: 'Hans Cousto',
    harmonics: [103.68, 414.72, 622.08],
    cymaticPatternName: 'Ruptura de Simetría Estelar',
    oscillatorsConfig: [
      osc({ f: 207.36, name: 'Urano 207.36 Hz', color: '#22d3ee', vol: 0.45 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Ambiental / Estimulación Creativa',
      usageMode: 'Útil durante sesiones de ideación, diseño y desbloqueo mental.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f_Urano = (1 / T_84a) × 2³⁹ = 207.36 Hz',
      naturalObjectResonance: 'Cortex asociativo frontal y redes neuronales de insight'
    }
  },
  {
    id: 'plan_moon',
    hz: '210.42',
    numericalHz: 210.42,
    name: 'Luna Sinódica (Sol#3)',
    category: 'planetary',
    description: 'Subconsciente, ritmos biológicos y fluido emocional.',
    detailedUsage: 'Basada en el mes sinódico lunar de 29.53 días (× 2²⁹). Regula los fluidos corporales, la intuición nocturna y la calma endocrina.',
    evidence: 'Hans Cousto',
    harmonics: [105.21, 420.84, 631.26],
    cymaticPatternName: 'Marea Lunar Concéntrica',
    oscillatorsConfig: [
      osc({ f: 210.42, name: 'Luna Sinódica 210.42 Hz', color: '#e2e8f0', vol: 0.48 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Nocturna / Fluido Corporal',
      usageMode: 'Ideal como sonido ambiental nocturno antes de dormir o para armonizar la hidratación corporal.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'f_Luna = (1 / 2,551,443 s) × 2²⁹ = 210.42 Hz',
      naturalObjectResonance: 'Mareas oceánicas, líquido linfático y ciclo lunar'
    }
  },
  {
    id: 'plan_neptune',
    hz: '211.44',
    numericalHz: 211.44,
    name: 'Neptuno - El Océano Místico (Sol#3)',
    category: 'planetary',
    description: 'Inspiración artística, misticismo y empatía.',
    detailedUsage: 'Frecuencia orbital de Neptuno (164.8 años × 2⁴⁰). Disuelve fronteras mentales rígidas y favorece estados oníricos y musicales.',
    evidence: 'Hans Cousto',
    harmonics: [105.72, 422.88, 634.32],
    cymaticPatternName: 'Onda Oceánica Estacionaria',
    oscillatorsConfig: [
      osc({ f: 211.44, name: 'Neptuno 211.44 Hz', color: '#60a5fa', vol: 0.45 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Envolvente / Meditación Onírica',
      usageMode: 'Adecuada como paisaje sonoro suave para contemplación, arte y relajación profunda.',
      recommendedVolume: '25% - 40%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: 'f_Neptuno = (1 / T_164.8a) × 2⁴⁰ = 211.44 Hz',
      naturalObjectResonance: 'Sueño REM, líquido cefalorraquídeo y resonancia acuática'
    }
  },
  {
    id: 'plan_ven',
    hz: '221.23',
    numericalHz: 221.23,
    name: 'Venus - Armonía y Estética (La3)',
    category: 'planetary',
    description: 'Amor incondicional, equilibrio y belleza.',
    detailedUsage: 'Frecuencia del año venusiano (224.7 días × 2³²). Armoniza las emociones, despierta la sensibilidad estética y equilibra el centro cardíaco.',
    evidence: 'Hans Cousto',
    harmonics: [110.615, 442.46, 663.69],
    cymaticPatternName: 'Rosa Pentagonal de Venus (5 Pétalos)',
    oscillatorsConfig: [
      osc({ f: 221.23, name: 'Venus 221.23 Hz', color: '#f472b6', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Cálida / Coherencia Estética',
      usageMode: 'Ideal como sonido de fondo suave en espacios habitables, armonización afectiva y descanso.',
      recommendedVolume: '30% - 48%',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: 'Geometría pentagonal orbital Tierra–Venus (5 pétalos cada 8 años)',
      harmonicEquation: 'f_Venus = (1 / 19,414,166 s) × 2³² = 221.23 Hz',
      naturalObjectResonance: 'Espirales pentagonales botánicas y cavidad torácica'
    }
  },
  {
    id: 'plan_hydrogen_line',
    hz: '338.65',
    numericalHz: 338.65,
    name: 'Línea Cósmica del Hidrógeno (1420.405 MHz ÷ 2²²)',
    category: 'planetary',
    description: 'Transición hiperfina de 21 cm del hidrógeno neutro reducida 22 octavas.',
    detailedUsage: 'El elemento más abundante del universo emite radiación electromagnética a 1,420,405,751.77 Hz. Al descender exactamente 22 octavas (÷ 2²²), emerge 338.65 Hz (y en 23 octavas, 169.33 Hz): la firma acústica fundamental del cosmos primordial.',
    evidence: 'Radioastronomía HI 21 cm / Octava Cósmica',
    location: 'Espacio Interestelar (Transición Hiperfina HI 21 cm)',
    harmonics: [169.33, 677.3, 1354.6, 2709.21],
    cymaticPatternName: 'Orbital Esférico 1s del Hidrógeno',
    oscillatorsConfig: [
      osc({ f: 338.65, name: 'Hidrógeno ÷ 2²² (338.65 Hz)', color: '#22d3ee', vol: 0.45 }),
      osc({ f: 169.33, name: 'Hidrógeno ÷ 2²³ (169.33 Hz)', color: '#0ea5e9', vol: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica', 'multimedio'],
      primaryMediumLabel: 'Acústica Cósmica + Armónico RF / NIR 805 nm',
      usageMode: 'Excelente en audio estéreo meditativo con sus dos octavas (169.33 + 338.65 Hz) o modulado en NIR 805 nm (su octava óptica exacta).',
      frequencyScales: {
        hz: '169.33 + 338.65 Hz (÷2²³ / ÷2²²)',
        khz: '21.674 kHz (÷2¹⁶)',
        mhz: '1420.405751 MHz (Original HI)',
        opticalNm: '805 nm (NIR Octava H × 2⁴⁰)'
      },
      recommendedVolume: '30% - 48% (~52 dB)',
      recommendedVoltage: '2 V - 9 V',
      recommendedAmperage: '80 mA - 350 mA',
      recommendedWatts: '1 W - 5 W',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: '1420.405 MHz ÷ 2²² = 338.651 Hz · Relación exacta con átomos de H en H₂O',
      harmonicEquation: 'f_HI = 1,420,405,751.77 Hz · f_aud = f_HI / 2²² = 338.6511 Hz',
      naturalObjectResonance: 'Hidrógeno interestelar, enlaces de hidrógeno del agua y protones biológicos'
    }
  },

  // =========================================================================
  // 3. NATURALEZA, AGUA & CRISTALES (9 partículas)
  // =========================================================================
  {
    id: 'nat_earth_hum',
    hz: '0.0037',
    numericalHz: 0.0037,
    name: 'Zumbido Sísmico Terrestre ("Earth Hum" ₀S₂₉)',
    category: 'nature',
    description: 'Oscilación libre planetaria continua a 3.7 mHz (en octava audible 242.48 Hz).',
    detailedUsage: 'Incluso sin terremotos, la Tierra vibra continuamente entre 2 y 7 mHz debido a olas oceánicas golpeando las plataformas continentales. El modo esferoidal ₀S₂₉ (3.7 mHz) y ₀S₃₇ (4.4 mHz), escalados 16 octavas, resuenan a 242.48 Hz y 288.36 Hz.',
    evidence: 'Sismología Global / Modos Normales Esferoidales ₀S₂₉',
    location: 'Océanos y Plataforma Continental Terrestre',
    harmonics: [121.24, 242.48, 288.36, 484.97],
    cymaticPatternName: 'Armónico Esférico Sísmico l=29',
    oscillatorsConfig: [
      osc({ f: 242.48, name: 'Earth Hum ₀S₂₉ × 2¹⁶', color: '#34d399', vol: 0.45, x: -0.3 }),
      osc({ f: 288.36, name: 'Earth Hum ₀S₃₇ × 2¹⁶', color: '#10b981', vol: 0.35, x: 0.3 }),
      osc({ f: 7.83, name: 'Schumann Ground', color: '#059669', vol: 0.5, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Octava Sísmica Acústica + Campo Magnético Terrestre',
      usageMode: 'La frecuencia física real (0.0037 Hz = período de 270 s) es infrasónica extrema; en la app se despliega su 16ª octava exacta (242.48 Hz y 288.36 Hz) para arraigo profundo.',
      frequencyScales: {
        hz: '0.0037 Hz (₀S₂₉) → 242.48 Hz (×2¹⁶)',
        khz: '1.940 kHz (×2¹⁹)',
        mhz: '1.986 MHz (×2²⁹)',
        opticalNm: '562 nm (Verde Telúrico ×2⁵⁷)'
      },
      recommendedVolume: '30% - 50%',
      recommendedVoltage: '3 V - 10 V DC',
      recommendedAmperage: '100 mA - 400 mA',
      recommendedWatts: '1 W - 6 W',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: 'Período sísmico 270.27 s · ₀S₃₇ octava 288.36 Hz ≈ Chakra Sacro 288 Hz',
      harmonicEquation: 'f_aud = 0.0037 Hz × 2¹⁶ = 242.48 Hz · 0.0044 Hz × 2¹⁶ = 288.36 Hz',
      naturalObjectResonance: 'Manto terrestre, océanos profundos y plataformas continentales'
    }
  },
  {
    id: 'nat_mycelium_bio',
    hz: '400',
    numericalHz: 400,
    name: 'Red Micelial Fúngica (Bioelectricidad & Señal)',
    category: 'nature',
    description: 'Conducción bioeléctrica micelial (100–10,000 Hz) y picos endógenos lentos.',
    detailedUsage: 'Basado en las mediciones del Prof. Andrew Adamatzky (UWE Bristol): las redes de micelio (Pleurotus, Ganoderma) emiten trenes de potenciales de acción lentos (~0.0064 Hz, período 2.6 min) y conducen señales exógenas de computación biológica en la banda 100–10,000 Hz (óptimo ~400 Hz).',
    evidence: 'Prof. Andrew Adamatzky - Unconventional Computing Lab (UWE Bristol)',
    location: 'UWE Bristol / Ecosistemas Forestales Miceliales',
    harmonics: [200, 400, 800, 1600],
    cymaticPatternName: 'Malla Rizomórfica Fractal',
    oscillatorsConfig: [
      osc({ f: 400, name: 'Conducción Micelial 400 Hz', color: '#34d399', vol: 0.45, x: -0.35 }),
      osc({ f: 419.43, name: 'Pico 0.0064 Hz × 2¹⁶', color: '#10b981', vol: 0.35, x: 0.35 }),
      osc({ f: 7.83, name: 'Suelo Forestal 7.83 Hz', color: '#059669', vol: 0.45, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Orgánica + Microcorriente / PEMF Suelo',
      usageMode: 'Funciona bien como paisaje sonoro orgánico de bosque para enfoque relajado o como señal PEMF suave sobre sustratos biológicos y cultivos.',
      recommendedVolume: '28% - 45%',
      recommendedVoltage: '1.5 V - 5 V (Señalización bioeléctrica)',
      recommendedAmperage: '10 mA - 120 mA',
      recommendedWatts: '0.2 W - 2 W',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '0.0064 Hz (2.6 min) × 2¹⁶ = 419.43 Hz (Cercano a Solfeggio 417 Hz)',
      harmonicEquation: 'f_spike = 1 / 156 s ≈ 0.0064 Hz · Bandpass_exógena ∈ [100, 10000] Hz',
      naturalObjectResonance: 'Hifas de Pleurotus ostreatus, Ganoderma y suelo humífero'
    }
  },
  {
    id: 'nat_feline_purr',
    hz: '26-50',
    numericalHz: 26,
    name: 'Ronroneo Felino Biomecánico (26 & 50 Hz)',
    category: 'nature',
    description: 'Frecuencias anabólicas de densidad ósea, tendones y alivio disneico.',
    detailedUsage: 'Los felinos ronronean entre 25 y 150 Hz con picos dominantes en 26 Hz y 50 Hz (y armónico en 100 Hz), coincidiendo exactamente con las frecuencias clínicas usadas para estimular osteoblastos, mineralización ósea y regeneración tisular.',
    evidence: 'Bioacústica Felina / Fauna Communications Research Institute',
    location: 'Felidae (Biomecánica Laríngea)',
    harmonics: [26, 50, 78, 100, 150],
    cymaticPatternName: 'Onda Mecánica Anabólica Estacionaria',
    oscillatorsConfig: [
      osc({ f: 26, name: 'Fundamental Ronroneo 26 Hz', type: 'triangle', color: '#34d399', vol: 0.65, cv: 1.3 }),
      osc({ f: 50, name: 'Pico Osteogénico 50 Hz', type: 'sine', color: '#10b981', vol: 0.5 }),
      osc({ f: 100, name: 'Armónico Muscular 100 Hz', type: 'sine', color: '#6ee7b7', vol: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Transductor Vibroacústico Corporal / Subwoofer',
      usageMode: 'Al estar en 26–50 Hz, su efecto fisiológico máximo se logra mediante transductores táctiles o altavoces con buenos graves apoyados cerca del torso o extremidades.',
      recommendedVolume: '40% - 65% (~60 dB)',
      recommendedVoltage: '4 V - 12 V DC',
      recommendedAmperage: '250 mA - 900 mA',
      recommendedWatts: '3 W - 12 W',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '26 Hz (Fundamental) + 50 Hz (Frecuencia de red anabólica) + 100 Hz',
      harmonicEquation: 'f ∈ [25, 150] Hz · f_pico1 = 26 Hz, f_pico2 = 50 Hz ≈ 2f_pico1',
      naturalObjectResonance: 'Trabéculas óseas, cartílago articular y músculos laríngeos felinos'
    }
  },
  {
    id: 'nat_beehive_piping',
    hz: '250-400',
    numericalHz: 250,
    name: 'Colmena Resonante ("Piping" Apis mellifera)',
    category: 'nature',
    description: 'Zumbido torácico del panal hexagonal (250 Hz obreras / 400 Hz reina).',
    detailedUsage: 'Las abejas transmiten vibraciones mecánicas directamente sobre las celdas hexagonales de cera: 180–250 Hz en obreras ventiladoras y 350–500 Hz ("tooting" ~400 Hz) en abejas reinas para coordinar la colmena.',
    evidence: 'Entomología Bioacústica / Apiterapia Vibracional',
    location: 'Colmenas Apis mellifera (Panal Hexagonal)',
    harmonics: [125, 250, 400, 500, 750],
    cymaticPatternName: 'Red Hexagonal de Cera Vibrante',
    oscillatorsConfig: [
      osc({ f: 250, name: 'Zumbido Obrera 250 Hz', type: 'triangle', color: '#facc15', vol: 0.45, x: -0.3, cv: 1.15 }),
      osc({ f: 400, name: 'Piping Reina 400 Hz', type: 'sine', color: '#f59e0b', vol: 0.35, x: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Ambiental Cálida / Apiterapia Sonora',
      usageMode: 'Muy agradable como sonido orgánico envolvente de relajación y calma parasimpática.',
      recommendedVolume: '30% - 48% (~52 dB)',
      recommendedVoltage: '1.5 V - 5 V RMS',
      recommendedAmperage: '60 mA - 250 mA',
      recommendedWatts: '1 W - 4 W',
      recommendedDuration: '15 - 35 min',
      numerologyRelation: 'Relación 400 / 250 = 8 : 5 (1.60 ≈ Proporción Áurea φ)',
      harmonicEquation: 'f_reina / f_obrera = 400 / 250 = 1.60 ≈ φ (Sexta menor justa)',
      naturalObjectResonance: 'Celdas hexagonales de cera de abeja y tórax de Apis mellifera'
    }
  },
  {
    id: 'nat_chlorophyll_a',
    hz: '634.09-823.75',
    numericalHz: 634.09,
    name: 'Clorofila-A Fotosintética (FRET 430 & 662 nm)',
    category: 'nature',
    description: 'Picos ópticos de absorción vegetal (430 nm azul y 662 nm rojo) en octava acústica.',
    detailedUsage: 'La clorofila-a absorbe fotones en 430 nm (697.19 THz → ÷ 2⁴⁰ = 634.09 Hz) y 662 nm (452.86 THz → ÷ 2³⁹ = 823.75 Hz) para impulsar la transferencia excitónica cuántica (FRET) del fotosistema.',
    evidence: 'Biofísica Fotosintética / Espectroscopía de Clorofila',
    location: 'Cloroplastos Vegetales (Tilacoides)',
    harmonics: [317.04, 411.88, 634.09, 823.75],
    cymaticPatternName: 'Anillo Porfirínico de Magnesio',
    oscillatorsConfig: [
      osc({ f: 634.09, name: 'Clorofila Azul 430nm ÷ 2⁴⁰', color: '#38bdf8', vol: 0.4, x: -0.45 }),
      osc({ f: 823.75, name: 'Clorofila Roja 662nm ÷ 2³⁹', color: '#f87171', vol: 0.4, x: 0.45 }),
      osc({ f: 528, name: 'Puente Verde 528 Hz', color: '#4ade80', vol: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_uv', 'fotonica_nir', 'acustica'],
      primaryMediumLabel: 'Fotónica Dual 430 nm + 662 nm + Acústica Armónica',
      usageMode: 'Su medio físico directo son diodos LED hortícolas de 430–450 nm y 660 nm; acústicamente sus octavas descendentes (634.09 + 823.75 Hz) armonizan entornos vegetales y meditación vital.',
      frequencyScales: {
        hz: '634.09 + 823.75 Hz (Octavas de 430/662 nm)',
        khz: '40.582 / 52.720 kHz',
        mhz: '41.556 / 26.992 MHz',
        opticalNm: '430 nm (Azul) + 662 nm (Rojo Clorofila-A)'
      },
      recommendedVolume: '25% - 42% (Audio) | LED 430/660 nm',
      recommendedVoltage: '3.0 V - 12 V DC (Driver LED)',
      recommendedAmperage: '300 mA - 1.2 A',
      recommendedWatts: '5 W - 20 W (Ópticos)',
      recommendedDuration: '20 - 60 min',
      numerologyRelation: '634.09 Hz vecina a Solfeggio 639 Hz · 528 Hz (516 nm verde reflejado)',
      harmonicEquation: 'f_azul = c / (430 nm · 2⁴⁰) = 634.09 Hz · f_rojo = c / (662 nm · 2³⁹) = 823.75 Hz',
      naturalObjectResonance: 'Complejos antena de Clorofila-A y hojas verdes fotosintéticas'
    }
  },
  {
    id: 'nat_tourmaline_pyro',
    hz: '512',
    numericalHz: 512,
    name: 'Turmalina Negra - Polarización Piroeléctrica & FIR',
    category: 'nature',
    description: 'Resonancia cristalina asimétrica de emisión iónica negativa e infrarrojo lejano.',
    detailedUsage: 'La turmalina posee un eje polar permanente sin centro de simetría (piroelectricidad y piezoelectricidad). Emite radiación infrarroja lejana (FIR 4–14 µm) y libera aniones al interactuar con cambios térmicos o presión acústica.',
    evidence: 'Cristalografía Mineralógica / Física del Estado Sólido',
    location: 'Pegmatitas Graníticas (Minerales Silicatos)',
    harmonics: [256, 512, 1024, 2048, 4096],
    cymaticPatternName: 'Simetría Trigonal Hexagonal (Eje c)',
    oscillatorsConfig: [
      osc({ f: 512, name: 'Armónico Turmalina 512 Hz', type: 'triangle', color: '#34d399', vol: 0.45 }),
      osc({ f: 1024, name: 'Octava Superior 1024 Hz', type: 'sine', color: '#6ee7b7', vol: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'ionica_plasma', 'acustica'],
      primaryMediumLabel: 'Infrarrojo Lejano (FIR) / Iones Negativos + Acústica 2⁹ Hz',
      usageMode: 'Ideal reproduciendo esta octava 2⁹ Hz cerca de cristales de turmalina/cuarzo o combinada con emisores térmicos FIR y purificadores de aniones.',
      frequencyScales: {
        hz: '512 + 1024 Hz (2⁹ / 2¹⁰)',
        khz: '32.768 kHz (2¹⁵)',
        mhz: '33.554 MHz (2²⁵)',
        opticalNm: '4,000–14,000 nm (FIR Mineral) · 533 nm (Octava 2⁹)'
      },
      recommendedVolume: '25% - 45%',
      recommendedVoltage: '5 V - 15 V DC',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 10 W',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: '512 = 2⁹ = 8³ (Cubo perfecto del 8)',
      harmonicEquation: 'P_piro = p · ΔT (Polarización espontánea en red trigonal 3m)',
      naturalObjectResonance: 'Turmalina Schorl, cristales trigonales y aire ionizado negativamente'
    }
  },
  {
    id: 'nat_ez_water_270',
    hz: '1009.85',
    numericalHz: 1009.85,
    name: 'Agua Estructurada EZ (4ª Fase · 270 nm UV & 3000 nm IR)',
    category: 'nature',
    description: 'Firma espectroscópica del agua cristalina líquida H₃O₂⁻ (Prof. Gerald Pollack).',
    detailedUsage: 'El agua en Zona de Exclusión (EZ) exhibe un pico de absorción UV único en 270 nm (1110.34 THz → ÷ 2⁴⁰ = 1009.85 Hz) y crece drásticamente al absorber luz infrarroja de 3000 nm (99.93 THz → ÷ 2³⁷ = 727.09 Hz). Actúa como batería biofísica con separación de carga.',
    evidence: 'Dr. Gerald Pollack - University of Washington (The Fourth Phase of Water)',
    location: 'Universidad de Washington (Lab. Pollack)',
    harmonics: [504.93, 727.09, 1009.85, 2019.7],
    cymaticPatternName: 'Lámina Hexagonal Honeycomb H₃O₂⁻',
    oscillatorsConfig: [
      osc({ f: 1009.85, name: 'Firma EZ 270 nm ÷ 2⁴⁰', color: '#38bdf8', vol: 0.35, x: -0.35 }),
      osc({ f: 727.09, name: 'Expansión IR 3000 nm ÷ 2³⁷', color: '#fb7185', vol: 0.4, x: 0.35 }),
      osc({ f: 528, name: 'Coherencia Hídrica 528 Hz', color: '#34d399', vol: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'fotonica_uv', 'acustica'],
      primaryMediumLabel: 'Fotónica IR 3000 nm (Expansión) + Acústica Estructurante',
      usageMode: 'Para estructurar agua físicamente, la radiación infrarroja cercana/media (~3000 nm / calor suave) es el combustible principal; en sonido, los armónicos 727.09 + 1009.85 Hz actúan como resonadores ordenadores sobre recipientes de vidrio.',
      frequencyScales: {
        hz: '727.09 + 1009.85 Hz (Octavas IR/UV EZ)',
        khz: '32.315 kHz (270 nm) / 46.534 kHz (3000 nm)',
        mhz: '33.091 / 47.651 MHz',
        opticalNm: '270 nm (Pico UV-C EZ) · 3000 nm (Resonancia IR Expansión)'
      },
      recommendedVolume: '25% - 45% (Sobre agua o entorno)',
      recommendedVoltage: '5 V - 12 V DC (Emisor IR)',
      recommendedAmperage: '250 mA - 1 A',
      recommendedWatts: '3 W - 15 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '¡727.09 Hz (3000 nm ÷ 2³⁷) coincide casi al hertz con Rife 727 Hz!',
      harmonicEquation: 'f_270 = c / (270 nm · 2⁴⁰) = 1009.85 Hz · f_3000 = c / (3000 nm · 2³⁷) = 727.09 Hz',
      naturalObjectResonance: 'Agua interfacial celular H₃O₂⁻, membranas hidrofílicas y colágeno'
    }
  },
  {
    id: 'nat_sonic_bloom',
    hz: '4320',
    numericalHz: 4320,
    name: 'Bioacústica Vegetal · Apertura Estomática ("Sonic Bloom")',
    category: 'nature',
    description: 'Banda del coro del alba aviar (3,000–5,000 Hz) que dilata estomas foliares.',
    detailedUsage: 'Investigado por Dan Carlson: las ondas sonoras armónicas entre 3 y 5 kHz (imitando el canto de aves al amanecer) estimulan mecánicamente la apertura de estomas foliares hasta un 50–70% más, multiplicando la absorción de nutrientes e intercambio de CO₂.',
    evidence: 'Dan Carlson (Sonic Bloom) / Bioacústica Agronómica',
    location: 'Invernaderos y Bosques al Amanecer',
    harmonics: [3200, 3840, 4320, 4800],
    cymaticPatternName: 'Matriz Estomática de Onda Aguda',
    oscillatorsConfig: [
      osc({ f: 3840, name: 'Estoma Base 3.84 kHz', color: '#4ade80', vol: 0.25, x: -0.4 }),
      osc({ f: 4320, name: 'Armónico Alba 4.32 kHz', color: '#34d399', vol: 0.28 }),
      osc({ f: 4800, name: 'Agudo Foliar 4.80 kHz', color: '#a7f3d0', vol: 0.22, x: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Direccional Suave para Plantas / Cultivos',
      usageMode: 'Reproducir en altavoces suaves orientados hacia follaje al amanecer o antes de riego foliar (mantener volumen bajo si hay personas cerca por el rango agudo 3.8–4.8 kHz).',
      recommendedVolume: '20% - 38% (~50 dB en invernadero)',
      recommendedVoltage: '2 V - 8 V RMS',
      recommendedAmperage: '100 mA - 350 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '15 - 25 min (Amanecer)',
      numerologyRelation: '4320 Hz = 10 × 432 Hz · 3840 = 10 × 384 Hz · 4800 = 10 × 480 Hz',
      harmonicEquation: 'f_estoma ∈ [3000, 5000] Hz · Δf = 480 Hz (Octava Corona)',
      naturalObjectResonance: 'Estomas foliares, células oclusivas vegetales y canto aviar'
    }
  },
  {
    id: 'nat_quartz_32768',
    hz: '32768',
    numericalHz: 32768,
    name: 'Cristal de Cuarzo Piezoeléctrico (2¹⁵ Hz)',
    category: 'nature',
    description: 'Frecuencia estándar de oscilación cristalina SiO₂ (32,768 Hz = 2¹⁵).',
    detailedUsage: 'El dióxido de silicio (cuarzo) convierte estrés mecánico en voltaje y viceversa. 32,768 Hz es exactamente 2¹⁵ ciclos/segundo: 15 divisiones binarias entregan 1 pulso/segundo exacto. Se despliegan sus sub-octavas audibles 2⁸ (256 Hz), 2¹² (4096 Hz) y 2¹⁴ (16384 Hz).',
    evidence: 'Física Piezoeléctrica del Cuarzo SiO₂ / IEEE Time Standards',
    location: 'Red Cristalina SiO₂ (Osciladores de Cuarzo)',
    harmonics: [256, 1024, 4096, 8192, 16384, 32768],
    cymaticPatternName: 'Diapasón Piezoeléctrico Binario 2ⁿ',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Sub-Octava Cuarzo 2⁸ (256 Hz)', color: '#34d399', vol: 0.4 }),
      osc({ f: 4096, name: 'Angel Cuarzo 2¹² (4096 Hz)', color: '#6ee7b7', vol: 0.22, x: -0.3 }),
      osc({ f: 16384, name: 'Sub-Ultrasónica 2¹⁴ (16.384 kHz)', color: '#a7f3d0', vol: 0.14, x: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'ionica_plasma', 'acustica'],
      primaryMediumLabel: 'Transductor Piezoeléctrico / PEMF 32.768 kHz + Sub-Octavas Audibles',
      usageMode: 'La frecuencia nativa 32.768 kHz supera el umbral auditivo humano (~20 kHz), por lo que requiere transductor piezoeléctrico ultrasónico o antena PEMF; los osciladores integrados proveen sus octavas audibles exactas (256 / 4096 / 16384 Hz).',
      frequencyScales: {
        hz: '32,768 Hz (Sub-octavas 256 / 4096 / 16384 Hz)',
        khz: '32.768 kHz',
        mhz: '33.554 MHz (×2¹⁰)',
        opticalNm: '533 nm (Verde Esmeralda 2⁴²)'
      },
      recommendedVolume: '15% - 35% (Sub-octavas)',
      recommendedVoltage: '3.3 V - 12 V DC (Driver Piezo / PEMF)',
      recommendedAmperage: '50 mA - 300 mA',
      recommendedWatts: '0.5 W - 4 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '32,768 = 2¹⁵ → Dividido 15 veces por 2 genera exactamente 1.000 Hz',
      harmonicEquation: 'f_cuarzo = 2¹⁵ Hz = 32,768 Hz · V = d₃₃ · F / C',
      naturalObjectResonance: 'Cristal de cuarzo α-SiO₂ y resonadores cronométricos'
    }
  },

  // =========================================================================
  // 4. CUERPO, CELULAR & BIOFÍSICA (7 partículas)
  // =========================================================================
  {
    id: 'body_heartmath_hrv',
    hz: '0.1',
    numericalHz: 0.1,
    name: 'Coherencia Cardíaca HRV (0.1 Hz / 6 Resp./min)',
    category: 'body',
    description: 'Sincronización de variabilidad cardíaca (HRV), ondas de Mayer y nervio vago.',
    detailedUsage: 'Documentado por el HeartMath Institute: respirar a 6 ciclos por minuto (5 s inhalar, 5 s exhalar = 0.1 Hz) alinea las oscilaciones barorreceptoras de presión arterial (ondas de Mayer) con el ritmo cardíaco y la coherencia alfa cerebral.',
    evidence: 'HeartMath Institute / Psychophysiology & Autonomic HRV',
    location: 'HeartMath Institute (California)',
    binauralBeatHz: 0.1,
    harmonics: [0.1, 10, 136.1, 341.33],
    cymaticPatternName: 'Toroide Cardíaco Sinusoidal',
    oscillatorsConfig: [
      osc({ f: 0.1, name: 'Pulso HRV 0.1 Hz (10s)', color: '#f87171', vol: 0.6, ind: true }),
      osc({ f: 136.1, name: 'Base OM (L)', color: '#fb7185', vol: 0.45, x: -0.7 }),
      osc({ f: 136.2, name: 'Deriva 0.1 Hz (R)', color: '#fda4af', vol: 0.45, x: 0.7 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Guía Respiratoria Binaural 0.1 Hz + Bobina Cardíaca',
      usageMode: 'Como 0.1 Hz es un ciclo de 10 segundos, la escucha binaural (136.10 vs 136.20 Hz) genera una respiración de fase cada 10 s ideal para guiar inhalaciones de 5 s y exhalaciones de 5 s.',
      frequencyScales: {
        hz: '0.10 Hz (Ciclo 10s) · Par 136.10 / 136.20 Hz',
        khz: '1.638 kHz',
        mhz: '1.678 MHz',
        opticalNm: '666 nm (Rojo Cardíaco)'
      },
      recommendedVolume: '30% - 45%',
      recommendedVoltage: '1.5 V - 5 V',
      recommendedAmperage: '40 mA - 200 mA',
      recommendedWatts: '0.5 W - 3 W',
      recommendedDuration: '10 - 20 min (Respiración coherente)',
      numerologyRelation: '0.1 Hz = 6 respiraciones/minuto = 360 ciclos/hora',
      harmonicEquation: 'f_HRV = 1 / 10 s = 0.10 Hz · Δf_binaural = 136.20 − 136.10 = 0.10 Hz',
      naturalObjectResonance: 'Nódulo sinoauricular, barorreceptores aórticos y ondas de Mayer'
    }
  },
  {
    id: 'body_schumann_blood',
    hz: '7.83-10',
    numericalHz: 7.83,
    name: 'Potencial Zeta Eritrocitario & Microcirculación',
    category: 'body',
    description: 'Estabilización del potencial zeta de membrana y fluidez capilar.',
    detailedUsage: 'Combina la base geomagnética 7.83 Hz con la banda alfa 10 Hz en campo PEMF de baja intensidad para reducir la agregación eritrocitaria ("efecto rouleaux") y mejorar la oxigenación capilar periférica.',
    evidence: 'Biofísica Hemorreológica / Magnetobiología PEMF',
    harmonics: [7.83, 10, 15.66, 20],
    cymaticPatternName: 'Discos Bicóncavos Estabilizados',
    oscillatorsConfig: [
      osc({ f: 7.83, name: 'Schumann Hemorreológico', color: '#f87171', vol: 0.65, ind: true }),
      osc({ f: 10, name: 'Pulso Capilar 10 Hz', color: '#fb7185', vol: 0.55, ind: true }),
      osc({ f: 256, name: 'Portadora Estéreo (L)', color: '#fca5a5', vol: 0.25, x: -0.75 }),
      osc({ f: 266, name: 'Binaural 10 Hz (R)', color: '#fecaca', vol: 0.25, x: 0.75 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica', 'acustica'],
      primaryMediumLabel: 'Colchoneta / Bobina PEMF Sistémica + Audio Estéreo',
      usageMode: 'Más efectiva mediante bobina PEMF sistémica de cuerpo completo a baja densidad de flujo (10–50 µT) mientras se descansa.',
      recommendedVolume: '25% - 40% (Si se usa audio binaural)',
      recommendedVoltage: '5 V - 15 V DC (Bobina PEMF)',
      recommendedAmperage: '200 mA - 800 mA',
      recommendedWatts: '2 W - 12 W',
      recommendedDuration: '20 - 30 min',
      harmonicEquation: 'ζ = 4πημ / ε (Potencial Zeta) · f_PEMF ∈ [7.83, 10] Hz',
      naturalObjectResonance: 'Eritrocitos sanguíneos, endotelio capilar y plasma'
    }
  },
  {
    id: 'body_bassett_15',
    hz: '15',
    numericalHz: 15,
    name: 'Osteogénesis PEMF de Bassett (15 Hz Clínico)',
    category: 'body',
    description: 'Estándar bioeléctrico ortopédico para consolidación ósea y canales Ca²⁺.',
    detailedUsage: 'Desarrollado por el Dr. Andrew Bassett (Columbia University, aprobado por la FDA en 1979 para fracturas sin unión). Los pulsos electromagnéticos asimétricos a 15 Hz inducen microcorrientes piezoeléctricas que activan osteoblastos, BMP y VEGF.',
    evidence: 'Dr. Andrew Bassett / Arthur Pilla (Columbia University / FDA PEMF)',
    location: 'Columbia University (Lab. Bioelectricidad Ósea)',
    harmonics: [15, 30, 45, 75, 128],
    cymaticPatternName: 'Retícula Trabecular Osteogénica',
    oscillatorsConfig: [
      osc({ f: 15, name: 'Pulso Bassett 15 Hz', type: 'square', color: '#f87171', vol: 0.6, ind: true, duty: 0.35, cv: 1.5 }),
      osc({ f: 128, name: 'Armónico Óseo 128 Hz', type: 'sine', color: '#fb923c', vol: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica'],
      primaryMediumLabel: 'Bobina PEMF Ortopédica Asimétrica (15 Hz)',
      usageMode: 'Frecuencia estrictamente electromagnética/inductiva: requiere bobina PEMF localizada sobre tejido óseo o articular (se añade 128 Hz para realimentación acústica opcional).',
      recommendedVolume: '20% - 35% (Tono guía) | PEMF prioritario',
      recommendedVoltage: '12 V - 24 V DC Pulsado',
      recommendedAmperage: '300 mA - 1.5 A',
      recommendedWatts: '5 W - 25 W (Campo 0.5–2 mT)',
      recommendedDuration: '30 - 60 min',
      numerologyRelation: '1 + 5 = 6 · Forma de onda asimétrica de pulso en ráfagas (burst)',
      harmonicEquation: 'J_ind = -σ · (dB/dt) · f_burst = 15 Hz',
      naturalObjectResonance: 'Matriz de hidroxiapatita-colágeno óseo y osteoblastos'
    }
  },
  {
    id: 'body_vagus_25',
    hz: '25',
    numericalHz: 25,
    name: 'Estimulación Vagal Parasimpática (Par Craneal X · 25 Hz)',
    category: 'body',
    description: 'Modulación del reflejo antiinflamatorio colinérgico y tono vagal.',
    detailedUsage: 'Frecuencia estándar utilizada en protocolos de estimulación auricular/transcutánea del nervio vago (tVNS) para reducir citoquinas proinflamatorias y equilibrar el eje intestino-cerebro-corazón.',
    evidence: 'Neuroinmunología / Protocolos Clínicos tVNS',
    harmonics: [25, 50, 100, 175],
    cymaticPatternName: 'Bucle Autonómico Biaxial',
    oscillatorsConfig: [
      osc({ f: 25, name: 'Pulso Vagal 25 Hz', type: 'triangle', color: '#f87171', vol: 0.65, ind: true }),
      osc({ f: 175, name: 'Armónico Cervical 175 Hz', color: '#fb7185', vol: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'acustica', 'multimedio'],
      primaryMediumLabel: 'Micro-PEMF Cervical/Auricular + Vibroacústica 25 Hz',
      usageMode: 'Aplicable mediante electrodo/bobina suave en rama auricular del vago o mediante tarareo/transductor vibroacústico en cuello y esternón.',
      recommendedVolume: '30% - 50% (Vibroacústica)',
      recommendedVoltage: '3 V - 9 V DC',
      recommendedAmperage: '5 mA - 250 mA (Según medio)',
      recommendedWatts: '0.5 W - 4 W',
      recommendedDuration: '15 - 25 min',
      numerologyRelation: '25 Hz = 5² · Sub-armónico directo de 50 Hz y 100 Hz',
      harmonicEquation: 'f_tVNS = 25 Hz (Período T = 40 ms)',
      naturalObjectResonance: 'Nervio vago (Par X), trago auricular y plexo entérico'
    }
  },
  {
    id: 'body_otto_128',
    hz: '128',
    numericalHz: 128,
    name: 'Diapasón Osteofónico Otto (128 Hz · Óxido Nítrico)',
    category: 'body',
    description: 'Liberación endotelial de Óxido Nítrico (NO) y resonancia ósea/articular.',
    detailedUsage: '128 Hz (2⁷ Hz, Do científico octava inferior) es el estándar clínico de diapasones ponderados ("Otto 128"). Al aplicarse por contacto óseo (esternón, vértebras, articulaciones), induce vasodilatación y liberación de óxido nítrico (NO).',
    evidence: 'Dr. John Beaulieu / Dr. George Stefano (BioSonics & Nitric Oxide)',
    harmonics: [64, 128, 256, 512, 1024],
    cymaticPatternName: 'Onda Estacionaria Binaria 2⁷',
    oscillatorsConfig: [
      osc({ f: 128, name: 'Otto Osteofónico 128 Hz', color: '#f87171', vol: 0.58 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Transductor Vibroacústico de Contacto Óseo / Diapasón 128 Hz',
      usageMode: 'Para su efecto fisiológico sobre óxido nítrico y articulaciones, usar transductor táctil sobre esternón/sacro o subwoofer cercano; también excelente como sonido grave de fondo.',
      frequencyScales: {
        hz: '128 Hz (2⁷)',
        khz: '1.024 kHz (2¹⁰)',
        mhz: '1.049 MHz (2²⁰)',
        opticalNm: '533 nm (Verde Esmeralda 2⁴²)'
      },
      recommendedVolume: '35% - 60% (~56 dB)',
      recommendedVoltage: '2 V - 9 V RMS',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '10 - 25 min',
      numerologyRelation: '128 = 2⁷ (Base pura de la escala científica Verdi 256 Hz)',
      harmonicEquation: 'f = 2⁷ Hz = 128 Hz · λ_hueso ≈ 27.3 m (v_hueso ≈ 3500 m/s)',
      naturalObjectResonance: 'Esternón, clavícula, endotelio vascular y tejido periostio'
    }
  },
  {
    id: 'body_dna_528_uv',
    hz: '1048.69',
    numericalHz: 1048.69,
    name: 'Resonancia Espectral del ADN (260 nm UV & 528 Hz)',
    category: 'body',
    description: 'Pico ultravioleta de ácidos nucleicos (260 nm) en su 40ª y 41ª octava.',
    detailedUsage: 'En biología molecular, las bases púricas y pirimidínicas del ADN/ARN absorben con máxima precisión a 260 nm (1153.05 THz). Al dividir 40 y 41 octavas se obtienen 1048.69 Hz y 524.35 Hz, en estrecha proximidad armónica con la frecuencia Solfeggio 528 Hz.',
    evidence: 'Espectroscopía Molecular UV de Ácidos Nucleicos (260 nm)',
    harmonics: [524.35, 528, 1048.69, 2097.38],
    cymaticPatternName: 'Doble Hélice Helicoidal de 10 Pares',
    oscillatorsConfig: [
      osc({ f: 1048.69, name: 'ADN 260 nm ÷ 2⁴⁰', color: '#a855f7', vol: 0.32, x: -0.35 }),
      osc({ f: 524.35, name: 'ADN 260 nm ÷ 2⁴¹', color: '#f87171', vol: 0.42, x: 0.35 }),
      osc({ f: 528, name: 'Solfeggio 528 Hz', color: '#4ade80', vol: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_uv', 'acustica', 'multimedio'],
      primaryMediumLabel: 'Biofotónica / Octava Acústica Cromosómica',
      usageMode: 'La longitud de onda física 260 nm es UV-C ionizante (solo analítica de laboratorio, no exponer piel directamente); usar sus octavas acústicas seguras (524.35 + 528 + 1048.69 Hz) o luz visible verde-azul segura.',
      frequencyScales: {
        hz: '524.35 + 528 + 1048.69 Hz',
        khz: '33.558 kHz',
        mhz: '34.364 MHz',
        opticalNm: '260 nm (Pico Absorción ADN) · 516 nm (Octava 528 Hz)'
      },
      recommendedVolume: '25% - 42%',
      recommendedVoltage: '1.5 V - 5 V (Audio)',
      recommendedAmperage: '60 mA - 220 mA',
      recommendedWatts: '0.5 W - 3 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: 'Δ(528 − 524.35) = 3.65 Hz (Pulso Delta natural)',
      harmonicEquation: 'f_260 = c / (260 nm · 2⁴¹) = 524.35 Hz ≈ 528 Hz',
      naturalObjectResonance: 'Anillos aromáticos de adenina, guanina, citosina y timina'
    }
  },
  {
    id: 'body_mitochondria_cco',
    hz: '673.23',
    numericalHz: 673.23,
    name: 'Citocromo c Oxidasa Mitocondrial (660/810 nm + 40 Hz)',
    category: 'body',
    description: 'Cromóforo Complejo IV mitocondrial para fotodisociación de NO y síntesis de ATP.',
    detailedUsage: 'La enzima mitocondrial Citocromo c Oxidasa absorbe óptimamente en 660 nm (CuB, ÷ 2³⁹ = 826.24 Hz) y 810 nm (CuA, ÷ 2³⁹ = 673.23 Hz). Al pulsar estos LEDs a 40 Hz se maximiza la producción de ATP y la neuroprotección sin sobrecalentamiento.',
    evidence: 'Dr. Michael Hamblin / Photobiomodulation (Complex IV CCO)',
    harmonics: [40, 336.61, 673.23, 826.24],
    cymaticPatternName: 'Cresta Mitocondrial Cuántica',
    oscillatorsConfig: [
      osc({ f: 673.23, name: 'CCO NIR 810nm ÷ 2³⁹', color: '#fb7185', vol: 0.38, x: -0.4 }),
      osc({ f: 826.24, name: 'CCO Rojo 660nm ÷ 2³⁹', color: '#ef4444', vol: 0.35, x: 0.4 }),
      osc({ f: 40, name: 'Pulso Gamma ATP 40 Hz', type: 'square', color: '#facc15', vol: 0.45, ind: true, duty: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'multimedio', 'acustica'],
      primaryMediumLabel: 'Panel LED Fotónico 660 nm + 810 nm Pulsado a 40 Hz',
      usageMode: 'Su aplicación biológica principal es fotobiomodulación directa con matrices LED 660 nm + 810 nm pulsadas a 40 Hz (20–50 mW/cm²); el audio acompaña con sus octavas armónicas exactas.',
      frequencyScales: {
        hz: '673.23 + 826.24 Hz (Modulación 40 Hz)',
        khz: '43.087 kHz (810nm) / 52.879 kHz (660nm)',
        mhz: '44.121 / 27.074 MHz',
        opticalNm: '660 nm (Rojo CuB) + 810 nm (NIR CuA Citocromo c)'
      },
      recommendedVolume: '25% - 40% (Audio) | LED 20–50 mW/cm²',
      recommendedVoltage: '12 V - 24 V DC (Driver LED Pulsado)',
      recommendedAmperage: '500 mA - 2.5 A',
      recommendedWatts: '10 W - 45 W (Panel PBM)',
      recommendedDuration: '12 - 20 min por zona',
      numerologyRelation: '810 nm ÷ 2³⁹ = 673.23 Hz · Modulación Gamma 40 Hz',
      harmonicEquation: 'ATP_sint = η_CCO · Φ(660/810 nm) · f_pulse(40 Hz)',
      naturalObjectResonance: 'Centros de cobre CuA/CuB y grupos hemo de la membrana mitocondrial'
    }
  },

  // =========================================================================
  // 5. RIFE, NOGIER & BIO-RESONANCIA (17 partículas)
  // =========================================================================
  {
    id: 'rife_kidney_9',
    hz: '9.2',
    numericalHz: 9.2,
    name: 'Resonancia Renal (Riñones)',
    category: 'bioresonance',
    description: 'Equilibrio osmótico y purificación hidrostática.',
    detailedUsage: 'Ritmo bioeléctrico de las nefronas según las tablas Paul Schmidt para optimizar la filtración glomerular y balance electrolítico.',
    evidence: 'Paul Schmidt Bio-Resonance Institute',
    harmonics: [18.4, 36.8, 73.6, 147.2],
    cymaticPatternName: 'Filtro Tubular Osmótico',
    oscillatorsConfig: [
      osc({ f: 9.2, name: 'Renal 9.2 Hz', color: '#fb923c', vol: 0.7, ind: true }),
      osc({ f: 147.2, name: '4ª Octava Renal 147.2 Hz', color: '#fdba74', vol: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica', 'acustica'],
      primaryMediumLabel: 'Bobina PEMF Lumbar + Octava Audible 147.2 Hz',
      usageMode: 'Preferible aplicar mediante bobina PEMF suave en zona lumbar hidratando previamente; el audio usa su 4ª octava 147.2 Hz como guía.',
      recommendedVolume: '25% - 40%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '20 - 30 min',
      harmonicEquation: 'f_oct4 = 9.2 × 2⁴ = 147.2 Hz',
      naturalObjectResonance: 'Nefronas renales y equilibrio osmótico corporal'
    }
  },
  {
    id: 'rife_liver_56',
    hz: '56',
    numericalHz: 56,
    name: 'Resonancia Hepática (Hígado)',
    category: 'bioresonance',
    description: 'Bio-desintoxicación hepática y filtración enzimática.',
    detailedUsage: 'Frecuencia del órgano según la escala de bio-resonancia Paul Schmidt / Rife. Favorece la metabolización de lípidos y la función hepatocelular.',
    evidence: 'Paul Schmidt Bio-Resonance',
    harmonics: [28, 112, 224, 448],
    cymaticPatternName: 'Lóbulo Hexagonal Hepático',
    oscillatorsConfig: [
      osc({ f: 56, name: 'Hepática 56 Hz', color: '#fb923c', vol: 0.58 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'acustica'],
      primaryMediumLabel: 'PEMF Hipocondrio Derecho / Vibroacústica 56 Hz',
      usageMode: 'Responde eficazmente en bobina PEMF o transductor grave apoyado suavemente sobre el cuadrante superior derecho del abdomen.',
      recommendedVolume: '35% - 55%',
      recommendedVoltage: '5 V - 15 V DC',
      recommendedAmperage: '200 mA - 700 mA',
      recommendedWatts: '2 W - 10 W',
      recommendedDuration: '20 - 30 min',
      harmonicEquation: 'f = 56 Hz = 7 × 8 Hz',
      naturalObjectResonance: 'Lobulillos hepáticos hexagonales y sistema biliar'
    }
  },
  {
    id: 'rife_lung_72',
    hz: '72',
    numericalHz: 72,
    name: 'Resonancia Alveolar (Pulmones)',
    category: 'bioresonance',
    description: 'Oxigenación celular y capacidad pulmonar vital.',
    detailedUsage: 'Estimula la elasticidad de la superficie alveolo-capilar para un intercambio eficiente de O₂/CO₂ y apertura bronquial.',
    evidence: 'Bio-Resonance Frequency Tables',
    harmonics: [36, 144, 288, 576],
    cymaticPatternName: 'Árbol Bronquial Fractal',
    oscillatorsConfig: [
      osc({ f: 72, name: 'Alveolar 72 Hz', color: '#fb923c', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Vibroacústica Torácica / PEMF Pulmonar',
      usageMode: 'Adecuada en transductor torácico, canto grave prolongado o bobina PEMF sobre pecho mientras se respira profundamente.',
      recommendedVolume: '35% - 55%',
      recommendedVoltage: '3.3 V - 12 V DC',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '7 + 2 = 9 · Sub-octava exacta de 144 Hz (Fibonacci) y Tetraedro 720°/10',
      harmonicEquation: 'f = 72 Hz = 144 / 2 Hz',
      naturalObjectResonance: 'Alvéolos pulmonares, pleura y caja torácica'
    }
  },
  {
    id: 'nogier_f_73',
    hz: '73',
    numericalHz: 73,
    name: 'Nogier F - Subcortical & Sistema Endocrino (73 Hz)',
    category: 'bioresonance',
    description: 'Estructuras subcorticales cerebrales, tálamo, hipotálamo y equilibrio hormonal.',
    detailedUsage: 'Frecuencia F de la escala original de Paul Nogier (mediante Señal Autonómica Vascular - VAS). Actúa sobre núcleos grises centrales, dolor facial, equilibrio neuroendocrino y estados depresivos.',
    evidence: 'Dr. Paul Nogier - Auriculomedicina & VAS',
    location: 'Lyon, Francia (Grupo Nogier)',
    harmonics: [146, 292, 584, 1168, 2336],
    cymaticPatternName: 'Núcleo Talámico Concéntrico',
    oscillatorsConfig: [
      osc({ f: 73, name: 'Nogier F (73 Hz)', type: 'square', color: '#fb923c', vol: 0.45, duty: 0.1 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'electromagnetica', 'acustica'],
      primaryMediumLabel: 'Láser / LED Pulsado Nogier F (73 Hz) + PEMF',
      usageMode: 'En clínica Nogier se aplica modulando un emisor infrarrojo/rojo o microcorriente auricular a 73 Hz; en audio mantiene el pulso base.',
      recommendedVolume: '25% - 45%',
      recommendedVoltage: '5 V - 12 V DC (Láser frío / LED)',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '10 - 20 min',
      numerologyRelation: 'Base entera de toda la progresión binaria Nogier: 73 × 2ⁿ',
      harmonicEquation: 'f_F = 73 Hz · f_G = 2f_F = 146 Hz · f_A = 4f_F = 292 Hz',
      naturalObjectResonance: 'Hipotálamo, tálamo y puntos auriculares subcorticales'
    }
  },
  {
    id: 'rife_heart_100',
    hz: '100',
    numericalHz: 100,
    name: 'Resonancia Miocárdica (Corazón)',
    category: 'bioresonance',
    description: 'Tonificación muscular cardíaca y circulación sistémica.',
    detailedUsage: 'Ajusta el tono del tejido miocárdico y el ritmo de perfusión coronaria en protocolos clásicos de bio-resonancia.',
    evidence: 'Bio-Resonance Organ Tables',
    harmonics: [50, 200, 300, 400],
    cymaticPatternName: 'Toroide Muscular de 10 Nodos',
    oscillatorsConfig: [
      osc({ f: 100, name: 'Miocárdica 100 Hz', color: '#fb923c', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Vibroacústica Suave / Campo Magnético Toroidal',
      usageMode: 'Audio suave o campo magnético de muy baja intensidad (evitar corrientes eléctricas directas sobre el pecho).',
      recommendedVolume: '25% - 45%',
      recommendedVoltage: '1.5 V - 5 V',
      recommendedAmperage: '50 mA - 200 mA',
      recommendedWatts: '0.5 W - 3 W',
      recommendedDuration: '15 - 25 min',
      harmonicEquation: 'f = 100 Hz = 2 × 50 Hz',
      naturalObjectResonance: 'Miocardio y circulación arterial coronaria'
    }
  },
  {
    id: 'nogier_g_146',
    hz: '146',
    numericalHz: 146,
    name: 'Nogier G - Corteza Cerebral & Memoria (146 Hz)',
    category: 'bioresonance',
    description: 'Córtex cerebral, trastornos psicosomáticos y dolor crónico neuropático.',
    detailedUsage: 'Frecuencia G de Paul Nogier (2 × 73 Hz). Utilizada en fotobiomodulación craneal y auriculoterapia para estimular la corteza prefrontal, claridad mental y modulación de dolor crónico.',
    evidence: 'Dr. Paul Nogier - Auriculomedicina',
    location: 'Lyon, Francia (Grupo Nogier)',
    harmonics: [73, 146, 292, 584, 1168],
    cymaticPatternName: 'Corteza Poligonal Simétrica',
    oscillatorsConfig: [
      osc({ f: 146, name: 'Nogier G (146 Hz)', color: '#fb923c', vol: 0.48 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'electromagnetica', 'acustica'],
      primaryMediumLabel: 'LED NIR Pulsado a 146 Hz + Acústica Cortical',
      usageMode: 'Muy efectiva pulsando diodos NIR 810 nm sobre corteza prefrontal o usando auriculoterapia; agradable también como sonido de concentración.',
      recommendedVolume: '25% - 45%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '12 - 25 min',
      numerologyRelation: '146 = 2 × 73 Hz · 1 + 4 + 6 = 11',
      harmonicEquation: 'f_G = 2 · f_F = 146 Hz',
      naturalObjectResonance: 'Neocórtex cerebral y áreas asociativas prefrontales'
    }
  },
  {
    id: 'nogier_a_292',
    hz: '292',
    numericalHz: 292,
    name: 'Nogier A - Ectodermo & Cicatrización (292 Hz / Base 2.28 Hz)',
    category: 'bioresonance',
    description: 'Tejido ectodérmico: piel, mucosas externas, nervios y reparación de cicatrices.',
    detailedUsage: 'Armónico láser estándar de la Frecuencia A de Nogier (base 2.28 Hz × 2⁷ = 291.84 ≈ 292 Hz). Regula la proliferación epitelial, inflamación superficial y regeneración cutánea.',
    evidence: 'Dr. Paul Nogier / Terapia Láser de Baja Potencia',
    location: 'Lyon, Francia (Grupo Nogier)',
    harmonics: [2.28, 73, 146, 292, 584],
    cymaticPatternName: 'Epitelio Reticular Ectodérmico',
    oscillatorsConfig: [
      osc({ f: 292, name: 'Nogier A Láser (292 Hz)', color: '#f97316', vol: 0.45 }),
      osc({ f: 2.28, name: 'Nogier A Base (2.28 Hz)', color: '#fb923c', vol: 0.4, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'electromagnetica', 'acustica'],
      primaryMediumLabel: 'Fotobiomodulación Roja 660 nm Pulsada 292 Hz',
      usageMode: 'En fototerapia cutánea se modula luz roja 660 nm a 292 Hz sobre piel/cicatrices; en audio funciona con su sub-pulso base 2.28 Hz.',
      recommendedVolume: '25% - 40%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '200 mA - 800 mA',
      recommendedWatts: '3 W - 10 W',
      recommendedDuration: '10 - 20 min',
      numerologyRelation: '292 = 4 × 73 Hz = 2.28125 × 2⁷ Hz',
      harmonicEquation: 'f_A = 2.28 Hz · f_A_laser = 2⁷ · f_A = 292 Hz',
      naturalObjectResonance: 'Epidermis, glándulas cutáneas y terminaciones nerviosas'
    }
  },
  {
    id: 'nogier_b_584',
    hz: '584',
    numericalHz: 584,
    name: 'Nogier B - Endodermo & Metabolismo (584 Hz / Base 4.56 Hz)',
    category: 'bioresonance',
    description: 'Tejido endodérmico: tracto digestivo, pulmones, hígado, páncreas y asimilación.',
    detailedUsage: 'Frecuencia B de Nogier (4.56 Hz × 2⁷ = 584 Hz). Armoniza funciones viscerales, equilibrio parasimpático digestivo y reacciones alérgicas mucosas.',
    evidence: 'Dr. Paul Nogier / Sedatelec Protocols',
    location: 'Lyon, Francia (Grupo Nogier)',
    harmonics: [4.56, 292, 584, 1168],
    cymaticPatternName: 'Malla Visceral Endodérmica',
    oscillatorsConfig: [
      osc({ f: 584, name: 'Nogier B Láser (584 Hz)', color: '#f97316', vol: 0.42 }),
      osc({ f: 4.56, name: 'Nogier B Base (4.56 Hz)', color: '#fb923c', vol: 0.4, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'electromagnetica', 'acustica'],
      primaryMediumLabel: 'PEMF Abdominal / Fotónica Modulada 584 Hz',
      usageMode: 'Aplicar mediante bobina PEMF o luz NIR 810 nm sobre área digestiva/visceral, o escuchar en audio suave tras las comidas.',
      recommendedVolume: '25% - 40%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '200 mA - 700 mA',
      recommendedWatts: '2 W - 9 W',
      recommendedDuration: '15 - 25 min',
      numerologyRelation: '584 = 8 × 73 Hz = 4.5625 × 2⁷ Hz',
      harmonicEquation: 'f_B = 2 · f_A = 4.56 Hz · f_B_laser = 584 Hz',
      naturalObjectResonance: 'Epitelio gastrointestinal, páncreas y parénquima visceral'
    }
  },
  {
    id: 'rife_727',
    hz: '727',
    numericalHz: 727,
    name: 'Regeneración Celular Rife (727 Hz)',
    category: 'bioresonance',
    description: 'Frecuencia universal de Rife para desactivación patógena e inmunidad.',
    detailedUsage: 'Una de las frecuencias maestras de la tabla histórica de Royal Rife (casi idéntica a la octava IR del agua EZ 727.09 Hz). Usada ampliamente en tubos de plasma y electroterapia.',
    evidence: 'Dr. Royal Raymond Rife Original Charts',
    harmonics: [363.5, 1454, 2181, 2908],
    cymaticPatternName: 'Anillo Lítico de 7 Nodos',
    oscillatorsConfig: [
      osc({ f: 727, name: 'Rife 727 Hz', type: 'square', color: '#fb923c', vol: 0.35, duty: 0.15 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['ionica_plasma', 'electromagnetica', 'acustica'],
      primaryMediumLabel: 'Tubo de Plasma Rife / Bobina PEMF Cuadrada',
      usageMode: 'Mucho más efectiva mediante tubo de plasma gaseoso (Phanotron) o bobina PEMF de onda cuadrada rica en armónicos impares que por audio puro.',
      recommendedVolume: '15% - 30% (Si se usa vía audio)',
      recommendedVoltage: '12 V DC (PEMF) | 1.5–3 kV RF (Plasma)',
      recommendedAmperage: '300 mA - 1.5 A',
      recommendedWatts: '5 W - 35 W',
      recommendedDuration: '10 - 20 min',
      numerologyRelation: 'Coincidencia física < 0.02% con octava 3000 nm Agua EZ (727.09 Hz)',
      harmonicEquation: 'Onda cuadrada 727 Hz → ∑ (4/π) · sin(2π·(2k+1)·727t) / (2k+1)',
      naturalObjectResonance: 'Membranas microbianas y agua interfacial celular'
    }
  },
  {
    id: 'rife_787',
    hz: '787',
    numericalHz: 787,
    name: 'Anti-Inflamatorio Bioeléctrico Rife (787 Hz)',
    category: 'bioresonance',
    description: 'Modulación del dolor tisular y reducción de edema.',
    detailedUsage: 'Normaliza el potencial transmembrana celular en tejidos sometidos a estrés inflamatorio o sobrecarga metabólica.',
    evidence: 'Dr. Royal Rife / Bio-Medical Frequency Tables',
    harmonics: [393.5, 1574, 2361],
    cymaticPatternName: 'Estrella Estabilizadora de Membrana',
    oscillatorsConfig: [
      osc({ f: 787, name: 'Rife 787 Hz', type: 'square', color: '#fb923c', vol: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'ionica_plasma', 'acustica'],
      primaryMediumLabel: 'PEMF Localizado / Plasma Rife',
      usageMode: 'Aplicar preferentemente mediante bobina PEMF o tubo de plasma; mantener volumen moderado-bajo en altavoces.',
      recommendedVolume: '15% - 30%',
      recommendedVoltage: '12 V - 24 V DC',
      recommendedAmperage: '250 mA - 1.2 A',
      recommendedWatts: '4 W - 20 W',
      recommendedDuration: '10 - 20 min',
      harmonicEquation: 'f_MOR = 787 Hz (Serie Rife 727–787–880 Hz)',
      naturalObjectResonance: 'Potencial de membrana celular (-70 mV) y tejido inflamado'
    }
  },
  {
    id: 'rife_880',
    hz: '880',
    numericalHz: 880,
    name: 'Resonancia Inmunológica Rife (880 Hz)',
    category: 'bioresonance',
    description: 'Refuerzo del terreno inmunológico y respuesta linfática.',
    detailedUsage: 'Tercera frecuencia de la tríada clásica Rife (727-787-880 Hz). Corresponde además a la octava exacta A5 de 440 Hz.',
    evidence: 'Dr. Royal Rife',
    harmonics: [440, 880, 1760, 2640],
    cymaticPatternName: 'Octágono Armónico Inmune',
    oscillatorsConfig: [
      osc({ f: 880, name: 'Rife 880 Hz', type: 'square', color: '#fb923c', vol: 0.32 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['ionica_plasma', 'electromagnetica', 'acustica'],
      primaryMediumLabel: 'Tubo de Plasma / PEMF Inmunológico',
      usageMode: 'Ideal en ciclos cortos de plasma/PEMF tras 727 y 787 Hz.',
      recommendedVolume: '15% - 28%',
      recommendedVoltage: '12 V - 24 V DC',
      recommendedAmperage: '250 mA - 1.2 A',
      recommendedWatts: '4 W - 25 W',
      recommendedDuration: '10 - 15 min',
      harmonicEquation: 'f = 880 Hz = 2 × 440 Hz',
      naturalObjectResonance: 'Ganglios linfáticos y leucocitos circulantes'
    }
  },
  {
    id: 'nogier_c_1168',
    hz: '1168',
    numericalHz: 1168,
    name: 'Nogier C - Mesodermo & Osteomuscular (1168 Hz / Base 9.12 Hz)',
    category: 'bioresonance',
    description: 'Sistema musculoesquelético: huesos, tendones, ligamentos, cartílago y circulación.',
    detailedUsage: 'Frecuencia C de Paul Nogier (9.125 Hz × 2⁷ = 1168 Hz). Focalizada en traumatismos deportivos, tendinopatías, rigidez miofascial y microcirculación mesodérmica.',
    evidence: 'Dr. Paul Nogier / Fotobiomodulación Ortopédica',
    location: 'Lyon, Francia (Grupo Nogier)',
    harmonics: [9.125, 584, 1168, 2336],
    cymaticPatternName: 'Retícula Fibrosa Mesodérmica',
    oscillatorsConfig: [
      osc({ f: 1168, name: 'Nogier C Láser (1168 Hz)', color: '#fb923c', vol: 0.35 }),
      osc({ f: 9.125, name: 'Nogier C Base (9.125 Hz)', color: '#fdba74', vol: 0.45, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'electromagnetica', 'acustica'],
      primaryMediumLabel: 'Láser / LED NIR 810–850 nm Pulsado 1168 Hz',
      usageMode: 'En ortopedia fotónica se modula luz NIR 810/850 nm a 1168 Hz sobre articulaciones o tendones; como audio mantener volumen suave.',
      recommendedVolume: '18% - 32%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '250 mA - 1 A',
      recommendedWatts: '3 W - 12 W',
      recommendedDuration: '10 - 20 min',
      harmonicEquation: 'f_C = 9.125 Hz · f_C_laser = 2⁷ · f_C = 1168 Hz = 16 × 73 Hz',
      naturalObjectResonance: 'Fibras de colágeno tipo I, tendones y miocitos'
    }
  },
  {
    id: 'rife_2127_1550',
    hz: '1550-2127',
    numericalHz: 2127,
    name: 'Complejo Rife Espectral (1550 Hz + 2127 Hz)',
    category: 'bioresonance',
    description: 'Frecuencias históricas de tubo Phanotron Rife para regeneración profunda.',
    detailedUsage: '1550 Hz y 2127 Hz figuran entre las frecuencias más documentadas de los archivos de laboratorio de Royal Rife y John Crane para modular resonancias celulares anómalas.',
    evidence: 'Royal Rife / John Crane Laboratory Archives',
    harmonics: [1550, 2127, 3100, 4254],
    cymaticPatternName: 'Interferencia Biaxial Aguda',
    oscillatorsConfig: [
      osc({ f: 2127, name: 'Rife 2127 Hz', type: 'square', color: '#f97316', vol: 0.25, x: -0.4, duty: 0.2 }),
      osc({ f: 1550, name: 'Rife 1550 Hz', type: 'square', color: '#fb923c', vol: 0.28, x: 0.4, duty: 0.2 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['ionica_plasma', 'electromagnetica'],
      primaryMediumLabel: 'Tubo de Plasma Rife / Bobina PEMF Alta Frecuencia',
      usageMode: 'Son frecuencias portadoras agudas diseñadas originalmente para tubo de plasma o electrodos de contacto/PEMF; si se usan en audio, bajar mucho el volumen (≤ 20%).',
      recommendedVolume: '10% - 22% (Opcional audio) | Plasma prioritario',
      recommendedVoltage: '12 V - 24 V DC / RF Plasma',
      recommendedAmperage: '300 mA - 1.5 A',
      recommendedWatts: '5 W - 40 W',
      recommendedDuration: '10 - 15 min',
      harmonicEquation: 'Δf = 2127 − 1550 = 577 Hz · Suma = 3677 Hz',
      naturalObjectResonance: 'Oscilación de membrana celular y campo iónico de plasma'
    }
  },
  {
    id: 'nogier_d_2336',
    hz: '2336',
    numericalHz: 2336,
    name: 'Nogier D - Integración Interhemisférica (2336 Hz / Base 18.25 Hz)',
    category: 'bioresonance',
    description: 'Comisuras cerebrales, lateralidad hemisférica, postura y coordinación motora.',
    detailedUsage: 'Frecuencia D de Paul Nogier (18.25 Hz × 2⁷ = 2336 Hz). Actúa sobre el cuerpo calloso y fibras asociativas reduciendo estrés neurogénico y disfunciones posturales.',
    evidence: 'Dr. Paul Nogier - Auriculomedicina',
    location: 'Lyon, Francia (Grupo Nogier)',
    harmonics: [18.25, 1168, 2336, 4672],
    cymaticPatternName: 'Puente Comisural Bilateral',
    oscillatorsConfig: [
      osc({ f: 2336, name: 'Nogier D Láser (2336 Hz)', color: '#fb923c', vol: 0.25 }),
      osc({ f: 18.25, name: 'Nogier D Base (18.25 Hz)', color: '#fdba74', vol: 0.45, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'electromagnetica'],
      primaryMediumLabel: 'Láser / LED Craneal Pulsado 2336 Hz + PEMF',
      usageMode: 'Muy superior mediante pulsación fotónica NIR transcraneal o bobina PEMF craneal suave; evitar volumen alto en altavoces por tono agudo.',
      recommendedVolume: '10% - 24%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '200 mA - 800 mA',
      recommendedWatts: '2 W - 10 W',
      recommendedDuration: '10 - 20 min',
      harmonicEquation: 'f_D = 18.25 Hz · f_D_laser = 2⁷ · f_D = 2336 Hz = 32 × 73 Hz',
      naturalObjectResonance: 'Cuerpo calloso y fascículos interhemisféricos'
    }
  },
  {
    id: 'nogier_e_4672',
    hz: '4672',
    numericalHz: 4672,
    name: 'Nogier E - Médula Espinal & Nervios (4672 Hz / Base 36.50 Hz)',
    category: 'bioresonance',
    description: 'Conducción nerviosa periférica, raíces espinales y analgesia neural.',
    detailedUsage: 'Frecuencia E de Paul Nogier (36.50 Hz × 2⁷ = 4672 Hz). Enfocada en neuropatías, ciática, regeneración axonal y distribución sensorial medular.',
    evidence: 'Dr. Paul Nogier / Neurofotobiomodulación',
    location: 'Lyon, Francia (Grupo Nogier)',
    harmonics: [36.5, 2336, 4672, 9344],
    cymaticPatternName: 'Eje Medular Axial de Alta Densidad',
    oscillatorsConfig: [
      osc({ f: 4672, name: 'Nogier E Láser (4672 Hz)', color: '#fb923c', vol: 0.2 }),
      osc({ f: 36.5, name: 'Nogier E Base (36.50 Hz)', color: '#fdba74', vol: 0.45, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'electromagnetica'],
      primaryMediumLabel: 'Fotónica NIR / Láser Paravertebral a 4672 Hz',
      usageMode: 'Por ubicarse en 4.67 kHz agudo, su modo óptimo es modular LED/Láser NIR a lo largo de la columna o aplicar PEMF; usar audio solo a nivel muy tenue.',
      recommendedVolume: '8% - 18%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '200 mA - 900 mA',
      recommendedWatts: '3 W - 12 W',
      recommendedDuration: '10 - 15 min',
      harmonicEquation: 'f_E = 36.50 Hz · f_E_laser = 2⁷ · f_E = 4672 Hz = 64 × 73 Hz',
      naturalObjectResonance: 'Médula espinal, vainas de mielina y plexos radiculares'
    }
  },
  {
    id: 'rife_detox',
    hz: '10000',
    numericalHz: 10000,
    name: 'Frecuencia Universal de Bio-Desintoxicación (10 kHz)',
    category: 'bioresonance',
    description: 'Estimulación del sistema linfático y purificación bioeléctrica.',
    detailedUsage: 'Frecuencia maestra de Royal Raymond Rife utilizada para armonizar el terreno celular y activar el drenaje linfático.',
    evidence: 'Dr. Royal Raymond Rife',
    harmonics: [2500, 5000, 10000, 20000],
    cymaticPatternName: 'Malla Ultrafina de Drenaje',
    oscillatorsConfig: [
      osc({ f: 10000, name: 'Rife Universal 10 kHz', type: 'square', color: '#fb923c', vol: 0.16, duty: 0.15 }),
      osc({ f: 2500, name: 'Sub-Octava /4 (2.5 kHz)', type: 'sine', color: '#fdba74', vol: 0.2 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['ionica_plasma', 'electromagnetica'],
      primaryMediumLabel: 'Tubo de Plasma / PEMF 10 kHz (No recomendado alto en audio)',
      usageMode: 'A 10 kHz, la aplicación física superior es mediante tubo de plasma, microcorriente o bobina PEMF; si se escucha por altavoz, mantener volumen muy bajo.',
      recommendedVolume: '8% - 18% (Audio) | Plasma/PEMF',
      recommendedVoltage: '9 V - 24 V DC',
      recommendedAmperage: '250 mA - 1.2 A',
      recommendedWatts: '4 W - 30 W',
      recommendedDuration: '10 - 20 min',
      harmonicEquation: 'f = 10⁴ Hz = 10.000 kHz',
      naturalObjectResonance: 'Sistema linfático y fluidos extracelulares'
    }
  },
  {
    id: 'clark_zapper_30k',
    hz: '30000',
    numericalHz: 30000,
    name: 'Protocolo Bioeléctrico Hulda Clark (30 kHz Offset+)',
    category: 'bioresonance',
    description: 'Onda cuadrada asimétrica de 30 kHz con desplazamiento positivo para bio-terreno.',
    detailedUsage: 'Formulado por la Dra. Hulda Clark: trenes de onda cuadrada positiva de ~30 kHz (duty cycle ~50%, offset > 0V) aplicados típicamente en ciclos 7-20-7-20-7 min. Se proporcionan sub-armónicos audibles /2, /8 y /16 dentro del pasa-banda Web Audio.',
    evidence: 'Dra. Hulda Regehr Clark - The Cure for All Diseases',
    harmonics: [1875, 3750, 7500, 15000, 30000],
    cymaticPatternName: 'Rejilla Cuadrada Polarizada 30 kHz',
    oscillatorsConfig: [
      osc({ f: 15000, name: 'Sub-Octava Clark /2 (15 kHz)', type: 'square', color: '#f97316', vol: 0.12, duty: 0.35, cv: 1.4 }),
      osc({ f: 3750, name: 'Sub-Octava /8 (3.75 kHz)', type: 'square', color: '#fb923c', vol: 0.16, duty: 0.35 }),
      osc({ f: 1875, name: 'Sub-Octava /16 (1.875 kHz)', type: 'sine', color: '#fdba74', vol: 0.22 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['ionica_plasma', 'electromagnetica'],
      primaryMediumLabel: 'Generador Bioeléctrico Offset+ / Tubo de Plasma 30 kHz',
      usageMode: '30 kHz es ultrasónico y puramente bioeléctrico (electrodos manuales con offset positivo de 5–9V DC o tubo de plasma). El motor de audio reproduce sus armónicos sub-octava 1.875 / 3.75 / 15 kHz.',
      frequencyScales: {
        hz: '30,000 Hz (Sub-octavas 1875 / 3750 / 15000 Hz)',
        khz: '30.000 kHz',
        mhz: '1.920 MHz (×2⁶)',
        opticalNm: '582 nm (Amarillo Solar)'
      },
      recommendedVolume: '8% - 16% (Monitor audio) | Electrodos 9V DC',
      recommendedVoltage: '5 V - 9 V DC (Offset positivo estrictamente >0 V)',
      recommendedAmperage: '2 mA - 15 mA (Electrodos) | 300 mA (PEMF)',
      recommendedWatts: '0.1 W - 4 W',
      recommendedDuration: 'Ciclo 7 min ON / 20 min OFF (×3)',
      harmonicEquation: 'f_Clark = 30 kHz · V(t) ∈ [0.25 V, +9 V] (Onda cuadrada positiva)',
      naturalObjectResonance: 'Membranas plasmáticas y terreno bioeléctrico sanguíneo'
    }
  },

  // =========================================================================
  // 6. PEMF, FOTÓNICA & PLASMA (8 partículas)
  // =========================================================================
  {
    id: 'em_tesla_1178',
    hz: '11.78',
    numericalHz: 11.78,
    name: 'Onda Estacionaria Terrestre & Bobina Bifilar de Tesla (11.78 Hz)',
    category: 'electromagnetic',
    description: 'Frecuencia telúrica de Tesla (~12 Hz) y geometría bifilar de cancelación inductiva.',
    detailedUsage: 'En "The Future of the Wireless Art" (1908), Nikola Tesla calculó que la carga eléctrica en la Tierra oscila ~11.78 veces por segundo como onda estacionaria global. Al excitar una bobina bifilar plana (Patente US 512,340) en oposición de fase (180°), se maximiza la capacitancia distribuida y el campo longitudinal/escalar.',
    evidence: 'Nikola Tesla (Patente US 512,340 / Colorado Springs & Wardenclyffe)',
    location: 'Colorado Springs / Wardenclyffe Lab',
    harmonics: [11.78, 23.56, 47.12, 94.24],
    cymaticPatternName: 'Espiral Bifilar Contra-Rotatoria (Δφ=180°)',
    oscillatorsConfig: [
      osc({ f: 11.78, name: 'Onda Terrestre Tesla 11.78 Hz', color: '#38bdf8', vol: 0.65, ind: true }),
      osc({ f: 94.24, name: 'Bobina Fase 0° (8×)', color: '#0ea5e9', vol: 0.35, phase: 0 }),
      osc({ f: 94.24, name: 'Bobina Bifilar 180°', color: '#7dd3fc', vol: 0.35, phase: 180 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['magnetica', 'electromagnetica'],
      primaryMediumLabel: 'Bobina Bifilar Plana de Tesla / Antena Escalar ELF',
      usageMode: 'Diseñada específicamente para excitar bobinas bifilares en configuración contra-fase (180°) o bobinas toroidales escalares a 11.78 Hz.',
      recommendedVolume: '25% - 45% (En amplificador de bobina)',
      recommendedVoltage: '12 V - 24 V DC',
      recommendedAmperage: '300 mA - 1.5 A',
      recommendedWatts: '5 W - 25 W',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '11.78 Hz ≈ 12 oscilaciones/s · 94.24 Hz en oposición de fase 180°',
      harmonicEquation: 'f_Tesla = c / (2 · D_Tierra) ≈ 11.78 Hz · C_bifilar ≫ C_simple',
      naturalObjectResonance: 'Corteza terrestre conductora y resonancia electromagnética global'
    }
  },
  {
    id: 'em_icr_k',
    hz: '20',
    numericalHz: 20,
    name: 'Ciclotrón Iónico Liboff: Potasio K⁺ (~20 Hz @ 50 µT)',
    category: 'electromagnetic',
    description: 'Resonancia de ciclotrón del catión K⁺ en el campo geomagnético terrestre.',
    detailedUsage: 'Según la ecuación de Abraham Liboff f_c = qB/(2πm), para el ion Potasio K⁺ (+1e, 39.1 u) bajo un campo geomagnético nominal de ~50 µT, la frecuencia ciclotrónica es ~19.6–20 Hz, modulando canales de potasio y potencial de reposo neuronal.',
    evidence: 'Dr. Abraham R. Liboff / Smith & McLeod (Ion Cyclotron Resonance)',
    harmonics: [20, 40, 60, 160],
    cymaticPatternName: 'Órbita Helical de Larmor K⁺',
    oscillatorsConfig: [
      osc({ f: 20, name: 'ICR Potasio K⁺ (20 Hz)', color: '#38bdf8', vol: 0.65, ind: true }),
      osc({ f: 160, name: 'Armónico Membrana 160 Hz', color: '#7dd3fc', vol: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica'],
      primaryMediumLabel: 'Bobina de Helmholtz / PEMF Paralela al Campo Geomagnético',
      usageMode: 'Requiere campo magnético alterno débil (AC 10–40 µT) alineado con el campo geomagnético estático local (~50 µT) mediante bobinas PEMF.',
      recommendedVolume: '20% - 35% (Monitor) | PEMF µT obligatorio',
      recommendedVoltage: '3 V - 12 V DC (Controlado en corriente)',
      recommendedAmperage: '50 mA - 300 mA',
      recommendedWatts: '0.5 W - 4 W (Campo 20–50 µT)',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: 'f_c(K⁺) = (q·B) / (2π·m_K) ≈ 19.6–20 Hz (B = 50 µT)',
      naturalObjectResonance: 'Canales de potasio Kv y bomba Na⁺/K⁺ ATPasa'
    }
  },
  {
    id: 'em_icr_ca2',
    hz: '24',
    numericalHz: 24,
    name: 'Ciclotrón Iónico Liboff: Calcio Ca²⁺ (~24 Hz / 16 Hz ventana Adey)',
    category: 'electromagnetic',
    description: 'Modulación resonante del flujo transmembrana de calcio Ca²⁺ (Liboff/Adey).',
    detailedUsage: 'El ion divalente Ca²⁺ (+2e, 40.08 u) a B ≈ 50 µT presenta f_c ≈ 38.3 Hz (y a ~31–32 µT = 24 Hz; ventana clásica de flujo de Adey-Blackman = 16 Hz). Regula señalización sináptica, calmodulina y osteogénesis.',
    evidence: 'A.R. Liboff (1985) / W. Ross Adey & Carl Blackman',
    harmonics: [16, 24, 38.3, 48],
    cymaticPatternName: 'Bucle Divalente de Larmor Ca²⁺',
    oscillatorsConfig: [
      osc({ f: 24, name: 'ICR Ca²⁺ Nominal 24 Hz', color: '#38bdf8', vol: 0.6, ind: true }),
      osc({ f: 16, name: 'Ventana Ca²⁺ Adey 16 Hz', color: '#0284c7', vol: 0.45, ind: true }),
      osc({ f: 192, name: 'Armónico Audible 192 Hz', color: '#7dd3fc', vol: 0.28 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica'],
      primaryMediumLabel: 'Bobina PEMF Calibrada en µT (Ciclotrón Ca²⁺)',
      usageMode: 'La resonancia ciclotrónica iónica es estrictamente magnético-electromagnética: ajustar según el campo magnético terrestre local (~30–50 µT).',
      recommendedVolume: '20% - 35%',
      recommendedVoltage: '3 V - 12 V DC',
      recommendedAmperage: '60 mA - 350 mA',
      recommendedWatts: '0.5 W - 5 W',
      recommendedDuration: '20 - 35 min',
      harmonicEquation: 'f_c(Ca²⁺) = (2e · B) / (2π · m_Ca) · Ventanas 16 Hz / 24 Hz / 38.3 Hz',
      naturalObjectResonance: 'Canales de calcio dependientes de voltaje (VGCC) y calmodulina'
    }
  },
  {
    id: 'em_icr_mg2',
    hz: '62',
    numericalHz: 62,
    name: 'Ciclotrón Iónico Liboff: Magnesio Mg²⁺ (~62 Hz @ 50 µT)',
    category: 'electromagnetic',
    description: 'Resonancia del catión Mg²⁺ para activación ATP y relajación neuromuscular.',
    detailedUsage: 'Para el ion divalente Mg²⁺ (+2e, 24.3 u) en el campo geomagnético de ~50 µT, f_c = qB/(2πm) ≈ 62–63 Hz. Cofactor de más de 300 reacciones enzimáticas y estabilizador de la molécula Mg-ATP.',
    evidence: 'Dr. Abraham R. Liboff / Bioelectromagnetics',
    harmonics: [31, 62, 124, 248],
    cymaticPatternName: 'Hexágono Coordinado Mg²⁺',
    oscillatorsConfig: [
      osc({ f: 62, name: 'ICR Magnesio Mg²⁺ (62 Hz)', color: '#38bdf8', vol: 0.55 }),
      osc({ f: 124, name: 'Armónico 124 Hz', color: '#7dd3fc', vol: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica', 'acustica'],
      primaryMediumLabel: 'Bobina PEMF 62 Hz / Vibroacústica Muscular',
      usageMode: 'Muy eficaz con bobina PEMF de intensidad µT o transductor vibroacústico sobre grupos musculares tensos.',
      recommendedVolume: '30% - 48%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '100 mA - 450 mA',
      recommendedWatts: '1 W - 6 W',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '62 Hz prácticamente adyacente al Sub-Solfeggio 63 Hz',
      harmonicEquation: 'f_c(Mg²⁺) = (2e · 50 µT) / (2π · 24.3 u) ≈ 62.9 Hz',
      naturalObjectResonance: 'Complejo Mg-ATP, receptores NMDA y fibras musculares'
    }
  },
  {
    id: 'em_icr_li',
    hz: '109',
    numericalHz: 109,
    name: 'Ciclotrón Iónico Liboff: Litio Li⁺ (~109 Hz @ 50 µT)',
    category: 'electromagnetic',
    description: 'Frecuencia ciclotrónica del ion Li⁺ para estabilización neuroquímica.',
    detailedUsage: 'Por su baja masa atómica (6.94 u), el ion Li⁺ alcanza f_c ≈ 109–110 Hz a 50 µT. Investigado en bioelectromagnetismo (Liboff, Persinger) para modular circuitos límbicos y neuroplasticidad.',
    evidence: 'A.R. Liboff / M.A. Persinger (Neuroelectromagnetics)',
    harmonics: [54.5, 109, 218, 436],
    cymaticPatternName: 'Nodal Límbico de Alta Simetría',
    oscillatorsConfig: [
      osc({ f: 109, name: 'ICR Litio Li⁺ (109 Hz)', color: '#38bdf8', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica', 'acustica'],
      primaryMediumLabel: 'Bobina PEMF Craneal Baja Intensidad + Audio 109 Hz',
      usageMode: 'Aplicar mediante bobina PEMF suave (10–50 µT) o audio meditativo; coincide casi exactamente con la resonancia megalítica 110–111 Hz.',
      recommendedVolume: '25% - 45%',
      recommendedVoltage: '3 V - 9 V DC',
      recommendedAmperage: '50 mA - 250 mA',
      recommendedWatts: '0.5 W - 3 W',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '109 Hz converge con el rango arqueoacústico 110–111 Hz',
      harmonicEquation: 'f_c(Li⁺) = (e · 50 µT) / (2π · 6.94 u) ≈ 109.9 Hz',
      naturalObjectResonance: 'Circuitos serotonérgicos y neurotransmisión límbica'
    }
  },
  {
    id: 'em_pbm_810_nir',
    hz: '641.55-673.23',
    numericalHz: 673.23,
    name: 'Fotobiomodulación Transcraneal NIR (810 & 850 nm)',
    category: 'electromagnetic',
    description: 'Ventana óptica de máxima penetración craneal modulada a 10 Hz / 40 Hz.',
    detailedUsage: 'Las longitudes de onda infrarrojas cercanas de 810 nm (÷ 2³⁹ = 673.23 Hz) y 850 nm (÷ 2³⁹ = 641.55 Hz) atraviesan cráneo y tejido blando sin absorción excesiva de hemoglobina ni agua, activando el metabolismo neuronal.',
    evidence: 'Hamblin / Gonzalez-Lima / Photobiomodulation Neuroscience',
    harmonics: [10, 40, 641.55, 673.23],
    cymaticPatternName: 'Haz Coherente Transcraneal NIR',
    oscillatorsConfig: [
      osc({ f: 673.23, name: 'NIR 810 nm ÷ 2³⁹', color: '#fb7185', vol: 0.38, x: -0.4 }),
      osc({ f: 641.55, name: 'NIR 850 nm ÷ 2³⁹', color: '#f43f5e', vol: 0.35, x: 0.4 }),
      osc({ f: 40, name: 'Modulador Gamma 40 Hz', type: 'square', color: '#38bdf8', vol: 0.4, ind: true, duty: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_nir', 'multimedio'],
      primaryMediumLabel: 'Matriz Fotónica Transcraneal LED/Láser 810 & 850 nm',
      usageMode: 'Requiere físicamente diodos LED o láseres NIR 810/850 nm modulados a 10 Hz (descanso) o 40 Hz (cognición); en la app se sintetizan sus octavas sonoras exactas.',
      frequencyScales: {
        hz: '641.55 + 673.23 Hz (Pulso 40 Hz)',
        khz: '41.059 / 43.087 kHz',
        mhz: '42.045 / 44.121 MHz',
        opticalNm: '810 nm + 850 nm (Infrarrojo Cercano Transcraneal)'
      },
      recommendedVolume: '20% - 38% (Audio) | 25–60 mW/cm² NIR',
      recommendedVoltage: '12 V - 24 V DC',
      recommendedAmperage: '600 mA - 3.0 A',
      recommendedWatts: '12 W - 60 W (Matriz LED)',
      recommendedDuration: '12 - 20 min',
      harmonicEquation: 'f_810 = c / (810 nm · 2³⁹) = 673.23 Hz · f_850 = c / (850 nm · 2³⁹) = 641.55 Hz',
      naturalObjectResonance: 'Corteza cerebral, microglía y citocromo c oxidasa neuronal'
    }
  },
  {
    id: 'em_gurwitsch_uv',
    hz: '681.65-1090.64',
    numericalHz: 681.65,
    name: 'Radiación Mitogenética Biofotónica de Gurwitsch (200–250 nm UV)',
    category: 'electromagnetic',
    description: 'Emisión ultra-débil de biofotones UV que coordina la mitosis celular.',
    detailedUsage: 'Descubierta por Alexander Gurwitsch (1923): células en división emiten biofotones UV coherentes (~190–250 nm, transmisibles a través de cuarzo pero bloqueados por vidrio ordinario). Sus octavas acústicas caen en 681.65 Hz (200 nm ÷ 2⁴¹) y 1090.64 Hz (250 nm ÷ 2⁴⁰).',
    evidence: 'Alexander Gurwitsch (1923) / Fritz-Albert Popp (Biophotonics)',
    harmonics: [340.82, 545.32, 681.65, 1090.64],
    cymaticPatternName: 'Huso Mitótico Biofotónico',
    oscillatorsConfig: [
      osc({ f: 681.65, name: 'UV 200 nm ÷ 2⁴¹', color: '#a855f7', vol: 0.35, x: -0.4 }),
      osc({ f: 1090.64, name: 'UV 250 nm ÷ 2⁴⁰', color: '#c084fc', vol: 0.3, x: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['fotonica_uv', 'acustica'],
      primaryMediumLabel: 'Biofotónica Endógena / Octava Sonora Segura (Sin UV-C directo)',
      usageMode: 'Los fotones nativos de 200–250 nm son emitidos endógenamente a intensidad ultra-débil (10–1000 fotones/cm²·s); NUNCA usar lámparas UV-C intensas sobre tejido humano. Reproducir como sonido armónico o luz violeta/UV-A segura.',
      frequencyScales: {
        hz: '681.65 + 1090.64 Hz (Octavas 200–250 nm)',
        khz: '43.626 / 34.900 kHz',
        mhz: '44.673 / 35.738 MHz',
        opticalNm: '200–250 nm (Biofotón Ultra-Débil Gurwitsch)'
      },
      recommendedVolume: '20% - 38%',
      recommendedVoltage: '1.5 V - 5 V (Audio / Óptica segura)',
      recommendedAmperage: '50 mA - 200 mA',
      recommendedWatts: '0.5 W - 3 W',
      recommendedDuration: '15 - 25 min',
      harmonicEquation: 'f_200 = c / (200 nm · 2⁴¹) = 681.65 Hz · f_250 = c / (250 nm · 2⁴⁰) = 1090.64 Hz',
      naturalObjectResonance: 'Células meristemáticas, cuarzo óptico y cavidades biofotónicas celulares'
    }
  },
  {
    id: 'em_montagnier_dna_water',
    hz: '1000-2000',
    numericalHz: 1500,
    name: 'Transducción Electromagnética Acuosa de Montagnier (500–3000 Hz + 7 Hz)',
    category: 'electromagnetic',
    description: 'Señales electromagnéticas ULF en diluciones acuosas estructuradas.',
    detailedUsage: 'Basado en los experimentos de Luc Montagnier y Emilio Del Giudice: solenoide de cobre excitado por un fondo de 7 Hz registra espectros entre 500 y 3000 Hz emitidos por dominios coherentes en agua altamente diluida.',
    evidence: 'Luc Montagnier / Emilio Del Giudice (Electromagnetic Signals in Water)',
    harmonics: [7, 500, 1000, 1500, 2000, 3000],
    cymaticPatternName: 'Dominio Coherente Acuoso QED',
    oscillatorsConfig: [
      osc({ f: 1000, name: 'Banda Acuosa 1 kHz', color: '#38bdf8', vol: 0.25, x: -0.4 }),
      osc({ f: 1500, name: 'Pico Central 1.5 kHz', color: '#0ea5e9', vol: 0.28 }),
      osc({ f: 2000, name: 'Armónico 2 kHz', color: '#7dd3fc', vol: 0.2, x: 0.4 }),
      osc({ f: 7, name: 'Activador Solenoide 7 Hz', color: '#22d3ee', vol: 0.55, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica', 'acustica'],
      primaryMediumLabel: 'Solenoide de Cobre Blindado / Bobina PEMF Acuosa',
      usageMode: 'Protocolo experimental de solenoide magnético sobre recipientes de agua purificada en ambiente de bajo ruido de red (50/60 Hz).',
      recommendedVolume: '18% - 32%',
      recommendedVoltage: '3 V - 12 V DC',
      recommendedAmperage: '100 mA - 500 mA',
      recommendedWatts: '1 W - 6 W',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Banda_EMS ∈ [500, 3000] Hz · f_excitación = 7 Hz',
      naturalObjectResonance: 'Dominios de coherencia QED en agua líquida pura'
    }
  },

  // =========================================================================
  // 7. NEUROACÚSTICA & CEREBRO (10 partículas)
  // =========================================================================
  {
    id: 'brain_epsilon',
    hz: '0.5',
    numericalHz: 0.5,
    name: 'Onda Epsilon (0.5 Hz)',
    category: 'brain',
    description: 'Estados extraordinarios de conciencia y meditación cuántica.',
    detailedUsage: 'Frecuencia cerebral infra-baja asociada a estados de samadhi profundo, suspensión metabólica meditativa y sincronización neuroendocrina.',
    evidence: 'Dr. Jeffrey Thompson / Neuroacoustic Research',
    binauralBeatHz: 0.5,
    harmonics: [0.5, 1.0, 2.0, 136.1],
    cymaticPatternName: 'Pulso Monopolar Ultralento',
    oscillatorsConfig: [
      osc({ f: 0.5, name: 'Epsilon 0.5 Hz', color: '#f472b6', vol: 0.6, ind: true }),
      osc({ f: 136.1, name: 'Base OM (L)', color: '#ec4899', vol: 0.4, x: -0.85 }),
      osc({ f: 136.6, name: 'Binaural 0.5 Hz (R)', color: '#f9a8d4', vol: 0.4, x: 0.85 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Auriculares Estéreo (Binaural 0.5 Hz) + PEMF Craneal',
      usageMode: 'Usar audífonos estéreo para percibir el batido interaural de 0.5 Hz sobre la portadora OM 136.1 Hz; en altavoces la onda de 0.5 Hz es inaudible.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '25 - 60 min',
      harmonicEquation: 'Δf_binaural = 136.6 − 136.1 = 0.5 Hz',
      naturalObjectResonance: 'Oscilaciones lentas corticales durante meditación profunda'
    }
  },
  {
    id: 'brain_delta_2',
    hz: '2.0',
    numericalHz: 2.0,
    name: 'Onda Delta Profunda (2.0 Hz)',
    category: 'brain',
    description: 'Sueño reparador no-REM y liberación de Hormona del Crecimiento (HGH).',
    detailedUsage: 'Frecuencia dominante en sueño profundo estadio N3. Estimula limpieza glinfática cerebral, consolidación inmunológica y regeneración tisular.',
    evidence: 'EEG Neuroscience / Sleep Medicine',
    binauralBeatHz: 2.0,
    harmonics: [2, 4, 8, 174],
    cymaticPatternName: 'Onda Lenta Bilateral Estacionaria',
    oscillatorsConfig: [
      osc({ f: 2.0, name: 'Delta 2.0 Hz', color: '#f472b6', vol: 0.55, ind: true }),
      osc({ f: 174, name: 'Base 174 Hz (L)', color: '#c084fc', vol: 0.42, x: -0.8 }),
      osc({ f: 176, name: 'Binaural 2.0 Hz (R)', color: '#f472b6', vol: 0.42, x: 0.8 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Auriculares Cómodos Nocturnos / Bobina PEMF Bajo Almohada',
      usageMode: 'Ideal antes o durante el sueño con auriculares estéreo suaves o bobina PEMF nocturna de baja intensidad.',
      recommendedVolume: '20% - 38%',
      recommendedDuration: '30 - 90 min',
      harmonicEquation: 'Δf_binaural = 176 − 174 = 2.0 Hz',
      naturalObjectResonance: 'Sistema glinfático cerebral y ritmo hipotalámico nocturno'
    }
  },
  {
    id: 'brain_theta_45',
    hz: '4.5',
    numericalHz: 4.5,
    name: 'Onda Theta Chamánica (4.5 Hz)',
    category: 'brain',
    description: 'Trance meditativo, memoria episódica e imaginería visual.',
    detailedUsage: 'Facilita el acceso al subconsciente profundo, la creatividad analógica y los estados hipnagógicos utilizados tradicionalmente en percusión chamánica (~4.5 golpes/s).',
    evidence: 'Monroe Institute / Antropología Acústica',
    binauralBeatHz: 4.5,
    harmonics: [4.5, 9, 18, 216],
    cymaticPatternName: 'Espiral Hipnagógica 4.5',
    oscillatorsConfig: [
      osc({ f: 4.5, name: 'Theta 4.5 Hz', color: '#a78bfa', vol: 0.55, ind: true }),
      osc({ f: 216, name: 'Base 216 Hz (L)', color: '#8b5cf6', vol: 0.42, x: -0.85 }),
      osc({ f: 220.5, name: 'Binaural 4.5 Hz (R)', color: '#f472b6', vol: 0.42, x: 0.85 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Auriculares Estéreo (Separación Binaural L/R)',
      usageMode: 'Requiere auriculares estéreo para inducir el arrastre dicótico en el complejo olivar superior a exactamente 4.5 Hz.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Δf_binaural = 220.5 − 216.0 = 4.5 Hz',
      naturalObjectResonance: 'Hipocampo y red neuronal por defecto (DMN)'
    }
  },
  {
    id: 'brain_theta_alpha_78',
    hz: '7.8',
    numericalHz: 7.8,
    name: 'Puente Creativo Theta–Alfa (7.8 Hz)',
    category: 'brain',
    description: 'Frontera neuroacústica de visualización creativa, neurofeedback e insight.',
    detailedUsage: 'El cruce exacto 7.8 Hz (borde entre Theta alto y Alfa bajo, en sincronía con Schumann) abre la puerta a la visualización lúcida, programación mental y síntesis artística.',
    evidence: 'Biofeedback EEG / Peniston Alpha-Theta Protocol',
    binauralBeatHz: 7.8,
    harmonics: [7.8, 15.6, 31.2, 216],
    cymaticPatternName: 'Puente Dual Cortical',
    oscillatorsConfig: [
      osc({ f: 216, name: 'Portadora 216 Hz (L)', color: '#f472b6', vol: 0.42, x: -0.8 }),
      osc({ f: 223.8, name: 'Binaural 7.8 Hz (R)', color: '#c084fc', vol: 0.42, x: 0.8 }),
      osc({ f: 7.8, name: 'Sub-Onda 7.8 Hz', color: '#22d3ee', vol: 0.45, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Auriculares Estéreo + Opcional Bobina Schumann',
      usageMode: 'Escuchar con ojos cerrados en postura cómoda usando auriculares estéreo durante 20–30 minutos.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 35 min',
      harmonicEquation: 'Δf = 223.8 − 216.0 = 7.8 Hz ≈ f_Schumann',
      naturalObjectResonance: 'Cortex parieto-occipital e hipocampo'
    }
  },
  {
    id: 'brain_alpha_10',
    hz: '10.0',
    numericalHz: 10.0,
    name: 'Onda Alfa Pura (10.0 Hz)',
    category: 'brain',
    description: 'Puente entre consciente y subconsciente; aprendizaje acelerado.',
    detailedUsage: 'Pico espectral clásico de Hans Berger. Induce calma alerta sin somnolencia, reduce la ansiedad y favorece la retención de memoria y serotonina.',
    evidence: 'Hans Berger (1929) / EEG Standard',
    binauralBeatHz: 10.0,
    harmonics: [10, 20, 40, 256],
    cymaticPatternName: 'Corona Alfa Decagonal (N=10)',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Base 256 Hz (L)', color: '#f472b6', vol: 0.42, x: -0.8 }),
      osc({ f: 266, name: 'Binaural 10 Hz (R)', color: '#ec4899', vol: 0.42, x: 0.8 }),
      osc({ f: 10, name: 'Pulso Alfa 10 Hz', color: '#fb7185', vol: 0.45, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Auriculares Estéreo / Fondo de Estudio',
      usageMode: 'Excelente con auriculares para estudio o trabajo creativo tranquilo; también funciona modulando luz o bobina PEMF a 10 Hz.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '25 - 60 min',
      harmonicEquation: 'Δf_binaural = 266 − 256 = 10.0 Hz',
      naturalObjectResonance: 'Ritmo occipital α cerebral y bucles tálamo-corticales'
    }
  },
  {
    id: 'brain_smr_135',
    hz: '13.5',
    numericalHz: 13.5,
    name: 'Ritmo Sensoriomotor SMR (13.5 Hz)',
    category: 'brain',
    description: 'Calma motora, control de impulsos y enfoque estable libre de ansiedad.',
    detailedUsage: 'Detectado sobre la corteza sensoriomotora cuando el cuerpo está quieto y la mente atenta (Sterman Neurofeedback). Muy usado para mejorar la latencia del sueño, atención sostenida y estabilidad emocional.',
    evidence: 'Dr. Barry Sterman / Neurofeedback Clínico SMR (12–15 Hz)',
    binauralBeatHz: 13.5,
    harmonics: [13.5, 27, 54, 256],
    cymaticPatternName: 'Simetría Sensoriomotora Central',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Portadora 256 Hz (L)', color: '#f472b6', vol: 0.42, x: -0.8 }),
      osc({ f: 269.5, name: 'Binaural SMR 13.5 Hz (R)', color: '#38bdf8', vol: 0.42, x: 0.8 }),
      osc({ f: 13.5, name: 'SMR 13.5 Hz', color: '#a855f7', vol: 0.4, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Auriculares Estéreo (Neuro-Enfoque SMR)',
      usageMode: 'Ideal durante lectura técnica, resolución de tareas o entrenamiento de atención tranquila.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Δf_binaural = 269.5 − 256.0 = 13.5 Hz',
      naturalObjectResonance: 'Giro precentral y corteza sensoriomotora'
    }
  },
  {
    id: 'brain_beta_18',
    hz: '18.0',
    numericalHz: 18.0,
    name: 'Onda Beta Alta (18.0 Hz)',
    category: 'brain',
    description: 'Procesamiento analítico denso y lógica cuantitativa.',
    detailedUsage: 'Frecuencia para cálculo matemático, programación, toma rápida de decisiones y activación ejecutiva cortical.',
    evidence: 'Cognitive Psychology / EEG Studies',
    binauralBeatHz: 18.0,
    harmonics: [18, 36, 72, 320],
    cymaticPatternName: 'Red Poligonal Ejecutiva',
    oscillatorsConfig: [
      osc({ f: 320, name: 'Portadora 320 Hz (L)', color: '#f472b6', vol: 0.4, x: -0.8 }),
      osc({ f: 338, name: 'Binaural 18 Hz (R)', color: '#ec4899', vol: 0.4, x: 0.8 }),
      osc({ f: 18, name: 'Beta 18 Hz', color: '#fb7185', vol: 0.4, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Auriculares Estéreo (Bloques de Trabajo Cortos)',
      usageMode: 'Usar en bloques de 20–30 minutos para trabajo analítico intenso; evitar en la noche o si hay sobreexcitación nerviosa.',
      recommendedVolume: '25% - 40%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'Δf_binaural = 338 − 320 = 18.0 Hz',
      naturalObjectResonance: 'Cortex prefrontal dorsolateral'
    }
  },
  {
    id: 'brain_gamma_40',
    hz: '40.0',
    numericalHz: 40.0,
    name: 'Onda Gamma Máxima (40.0 Hz)',
    category: 'brain',
    description: 'Sincronización neuro-cortical global, insight y memoria.',
    detailedUsage: 'Vibración cortical vinculada al "binding problem" cognitivo y momentos de lucidez. Investigaciones del MIT (Dra. Li-Huei Tsai) muestran activación microglial y reducción de placas beta-amiloides con estimulación audiovisual a 40 Hz.',
    evidence: 'MIT Picower Institute / Dra. Li-Huei Tsai (GENUS 40 Hz)',
    location: 'MIT Picower Institute (Cambridge)',
    binauralBeatHz: 40.0,
    harmonics: [40, 80, 120, 400, 440],
    cymaticPatternName: 'Malla Gamma de Alta Coherencia',
    oscillatorsConfig: [
      osc({ f: 400, name: 'Base 400 Hz (L)', color: '#f472b6', vol: 0.38, x: -0.8 }),
      osc({ f: 440, name: 'Binaural Gamma 40 Hz (R)', color: '#e879f9', vol: 0.38, x: 0.8 }),
      osc({ f: 40, name: 'Onda Gamma 40 Hz', color: '#facc15', vol: 0.5, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['multimedio', 'acustica', 'fotonica_nir'],
      primaryMediumLabel: 'Sincronización Audio-Visual 40 Hz (Auriculares / LED)',
      usageMode: 'Excelente con auriculares estéreo (400/440 Hz) o en altavoces con pulsos isocrónicos a 40 Hz; también compatible con LEDs suaves pulsados a 40 Hz.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Δf = 440 − 400 = 40.0 Hz (GENUS 40 Hz)',
      naturalObjectResonance: 'Interneuronas parvalbúmina GABAérgicas y microglía cortical'
    }
  },
  {
    id: 'brain_high_gamma_80',
    hz: '80.0',
    numericalHz: 80.0,
    name: 'Hiper-Gamma Lucidez (80.0 Hz)',
    category: 'brain',
    description: 'Integración cognitiva superior, sincronicidad perceptual y flujo rápido.',
    detailedUsage: 'Primer armónico superior de 40 Hz. Asociada a picos de procesamiento rápido sensorial y estados de concentración excepcional en meditadores avanzados.',
    evidence: 'High-Frequency EEG / Neurociencia Contemplativa',
    harmonics: [40, 80, 160, 320],
    cymaticPatternName: 'Estrella Hiper-Gamma de 8 Ejes',
    oscillatorsConfig: [
      osc({ f: 80, name: 'Hiper-Gamma 80 Hz', color: '#f472b6', vol: 0.5 }),
      osc({ f: 320, name: 'Armónico 4× (320 Hz)', color: '#f9a8d4', vol: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Directa / Auriculares de Alta Fidelidad',
      usageMode: 'Al estar en 80 Hz audible directo, puede escucharse tanto en altavoces como auriculares sin necesidad de batido binaural artificial.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '15 - 25 min',
      harmonicEquation: 'f = 2 × 40 Hz = 80.0 Hz',
      naturalObjectResonance: 'Redes tálamo-corticales de banda rápida'
    }
  },
  {
    id: 'brain_lambda_200',
    hz: '200.0',
    numericalHz: 200.0,
    name: 'Onda Lambda Ultra-Alta (200 Hz)',
    category: 'brain',
    description: 'Procesamiento ultrarrápido de información intuitiva y unificación.',
    detailedUsage: 'Banda ultra-rápida EEG (100–200 Hz) documentada en meditadores avanzados durante experiencias de claridad total e integración holística.',
    evidence: 'Advanced EEG / Ripple & Lambda Brainwave Studies',
    harmonics: [100, 200, 400, 600],
    cymaticPatternName: 'Mandala Radial Lambda',
    oscillatorsConfig: [
      osc({ f: 200, name: 'Lambda 200 Hz', color: '#f472b6', vol: 0.45 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Ambiental Limpia / Meditación Silenciosa',
      usageMode: 'Reproducir a volumen suave como tono puro contemplativo.',
      recommendedVolume: '22% - 40%',
      recommendedDuration: '10 - 25 min',
      harmonicEquation: 'f = 5 × 40 Hz = 200.0 Hz',
      naturalObjectResonance: 'Oscilaciones rápidas ("high-frequency ripples") en hipocampo y córtex'
    }
  },

  // =========================================================================
  // 8. NUMEROLOGÍA, FIBONACCI & PHI (8 partículas)
  // =========================================================================
  {
    id: 'num_108_vedic',
    hz: '108',
    numericalHz: 108,
    name: 'Constante Védica 108 (Astronomía & Mala)',
    category: 'numerology',
    description: 'Relación astronómica Sol–Tierra–Luna (108× diámetros) y resonancia nasal védica.',
    detailedUsage: 'La distancia Tierra-Sol equivale aproximadamente a 108 diámetros solares, y la distancia Tierra-Luna a ~108 diámetros lunares; un pentágono regular tiene ángulos internos de 108°. En acústica es el Hum clásico de grandes cuencos y cantos.',
    evidence: 'Astronomía Numérica Védica / Geometría Pentagonal',
    harmonics: [54, 108, 216, 324, 432, 888],
    cymaticPatternName: 'Pentágono Áureo 108°',
    oscillatorsConfig: [
      osc({ f: 108, name: 'Védica 108 Hz', color: '#fcd34d', vol: 0.55 }),
      osc({ f: 216, name: 'Octava 216 Hz', color: '#fbbf24', vol: 0.28 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Meditativa / Entonación Vocal OM 108 Hz',
      usageMode: 'Excelente como tono base de meditación profunda o acompañamiento para recitación y respiración consciente.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: '1 + 0 + 8 = 9 · 108 × 4 = 432 Hz · Ángulo interior del pentágono = 108°',
      harmonicEquation: 'f = 432 / 4 = 108 Hz · 1² × 2² × 3³ = 108',
      naturalObjectResonance: 'Geometría pentagonal, senos paranasales y cuencos de bronce'
    }
  },
  {
    id: 'num_alpha_137',
    hz: '137.036',
    numericalHz: 137.036,
    name: 'Constante de Estructura Fina α⁻¹ (137.036 Hz)',
    category: 'numerology',
    description: 'Inverso adimensional de la constante de acoplamiento electromagnético cuántico.',
    detailedUsage: 'α⁻¹ ≈ 137.035999 (Richard Feynman / Wolfgang Pauli) determina la fuerza exacta con que electrones y fotones interactúan en todo el universo. En 137.036 Hz dialoga casi al hertz con el Tono OM terrestre 136.10 Hz (diferencia 0.936 Hz).',
    evidence: 'Electrodinámica Cuántica (QED) / CODATA α⁻¹ = 137.035999',
    harmonics: [137.036, 274.072, 411.108, 548.144],
    cymaticPatternName: 'Acoplamiento QED Electrón–Fotón',
    oscillatorsConfig: [
      osc({ f: 137.036, name: 'Estructura Fina α⁻¹ (137.036 Hz)', color: '#fcd34d', vol: 0.52 }),
      osc({ f: 274.072, name: 'Octava 2α⁻¹ (274.072 Hz)', color: '#fbbf24', vol: 0.24 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Cuántica / Emisión EM Coherente',
      usageMode: 'Ideal como sonido de fondo contemplativo o estudio científico profundo; comparte banda espectral con OM 136.10 Hz (497 nm azul-verde óptico).',
      recommendedVolume: '30% - 48%',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '137.036 ≈ 137 (33º número primo · ángulo áureo 360°/φ² = 137.508°)',
      harmonicEquation: 'α⁻¹ = 4πε₀ℏc / e² = 137.035999... · Angulo Áureo = 137.508°',
      naturalObjectResonance: 'Interacción fotón-electrón y filotaxis espiral botánica (137.5°)'
    }
  },
  {
    id: 'num_144_light',
    hz: '144',
    numericalHz: 144,
    name: 'Armónico de la Luz 144 (12² · Fibonacci F₁₂)',
    category: 'numerology',
    description: 'Duodécimo número de Fibonacci, 12² y armónico de la velocidad de la luz (Bruce Cathie).',
    detailedUsage: '144 es simultáneamente el 12º término de Fibonacci (F₁₂ = 12²), la raíz de 432/3, y en la armónica de cuadrícula de Bruce Cathie simboliza el coeficiente de velocidad lumínica en unidades geodésicas.',
    evidence: 'Sucesión de Fibonacci / Bruce Cathie Harmonic Grid',
    harmonics: [72, 144, 233, 288, 432],
    cymaticPatternName: 'Matriz Reticular 12×12',
    oscillatorsConfig: [
      osc({ f: 144, name: 'Armónico 144 Hz (12²)', color: '#fcd34d', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Armónica / Resonancia Cristal-Luz',
      usageMode: 'Tono muy cálido y estable como sonido de fondo de claridad mental, programación o trabajo geométrico.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: '1 + 4 + 4 = 9 · F₁₂ = 144 = 12² · 144 × 3 = 432 Hz',
      harmonicEquation: 'F₁₂ = 144 · F₁₃ / F₁₂ = 233 / 144 = 1.61805 ≈ φ',
      naturalObjectResonance: 'Espirales de semillas (girasol/piñas) y retículas cristalinas'
    }
  },
  {
    id: 'num_phi_1618',
    hz: '161.803',
    numericalHz: 161.803,
    name: 'Proporción Áurea φ (161.803 Hz & 261.803 Hz)',
    category: 'numerology',
    description: 'Escala de autosimilitud fractal φ = (1+√5)/2 = 1.6180339...',
    detailedUsage: 'La razón áurea φ es el número más irracional de las matemáticas, minimizando la interferencia destructiva en empaquetamientos biológicos. Se configura 161.803 Hz junto a su extensión φ² × 100 = 261.803 Hz (razón exacta φ:1).',
    evidence: 'Euclides / Geometría Áurea & Filotaxis',
    harmonics: [100, 161.803, 261.803, 423.607],
    cymaticPatternName: 'Espiral Logarítmica Áurea φ',
    oscillatorsConfig: [
      osc({ f: 161.803, name: 'Phi 100·φ (161.803 Hz)', color: '#fcd34d', vol: 0.45, x: -0.35 }),
      osc({ f: 261.803, name: 'Phi² 100·φ² (261.803 Hz)', color: '#f59e0b', vol: 0.4, x: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Estéreo Áurea / Diseño Fractal',
      usageMode: 'Perfecta como música de fondo de diseño, arquitectura y contemplación geométrica.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: 'φ² = φ + 1 = 2.618034 · 261.803 / 161.803 = φ',
      harmonicEquation: 'φ = (1 + √5) / 2 ≈ 1.618034 · f₂ / f₁ = φ',
      naturalObjectResonance: 'Conchas Nautilus, huracanes, ADN (34 Å / 21 Å ≈ φ) y galaxias espirales'
    }
  },
  {
    id: 'num_euler_271',
    hz: '271.828',
    numericalHz: 271.828,
    name: 'Constante de Euler e (271.828 Hz)',
    category: 'numerology',
    description: 'Base de los logaritmos naturales e ≈ 2.7182818... (crecimiento continuo).',
    detailedUsage: 'Constante universal del crecimiento orgánico continuo, decaimiento armónico e identidad de Euler (e^(iπ) + 1 = 0). En 271.828 Hz dialoga casi al unísono con la octava del año terrestre 272.20 Hz (2 × 136.10 Hz).',
    evidence: 'Leonhard Euler / Análisis Matemático',
    harmonics: [135.914, 271.828, 543.656, 738.906],
    cymaticPatternName: 'Curva Exponencial e^x Armónica',
    oscillatorsConfig: [
      osc({ f: 271.828, name: 'Constante Euler e (271.83 Hz)', color: '#fcd34d', vol: 0.48 }),
      osc({ f: 135.914, name: 'Sub-Octava e/2 (135.91 Hz)', color: '#fbbf24', vol: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica de Enfoque / Flujo Cognitivo',
      usageMode: 'Sonido suave de fondo para trabajo científico, programación y análisis complejo.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: '271.828 Hz está a solo 0.37 Hz de la octava OM Terrestre (272.20 Hz)',
      harmonicEquation: 'e = lim(n→∞) (1 + 1/n)ⁿ = 2.7182818... · e^(iπ) + 1 = 0',
      naturalObjectResonance: 'Crecimiento celular exponencial y decaimiento acústico natural'
    }
  },
  {
    id: 'num_369_vortex',
    hz: '369',
    numericalHz: 369,
    name: 'Código Vórtex 3-6-9 (369 Hz)',
    category: 'numerology',
    description: 'Eje matemático de duplicación binaria 1-2-4-8-7-5 gobernado por 3, 6 y 9.',
    detailedUsage: 'En aritmética modular (mod 9), la duplicación binaria cicla eternamente por 1-2-4-8-7-5 mientras 3 y 6 oscilan entre sí y el 9 permanece invariante como eje polar del toroide.',
    evidence: 'Marko Rodin (Matemática Vórtex) / Nikola Tesla',
    harmonics: [123, 369, 639, 738, 963],
    cymaticPatternName: 'Toroide Vórtex 1-2-4-8-7-5 / 3-6-9',
    oscillatorsConfig: [
      osc({ f: 369, name: 'Vórtex 369 Hz', color: '#fcd34d', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Acústica Toroidal / Bobina Rodin',
      usageMode: 'Ideal como sonido de fondo contemplativo o alimentando bobinas toroidales Rodin.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 35 min',
      numerologyRelation: '3 + 6 + 9 = 18 → 9 · Permutaciones: 369, 639, 963',
      harmonicEquation: '2ⁿ mod 9 ∈ {1, 2, 4, 8, 7, 5} · 3·2ⁿ mod 9 ∈ {3, 6} · 9·k mod 9 ≡ 9',
      naturalObjectResonance: 'Flujos toroidales magnéticos y campos vorticiales'
    }
  },
  {
    id: 'num_platonic_solids',
    hz: '72-144-216-360-648',
    numericalHz: 216,
    name: 'Matriz de los 5 Sólidos Platónicos (72·144·216·360·648 Hz)',
    category: 'numerology',
    description: 'Suma exacta de ángulos internos faciales (÷10) de los cinco poliedros regulares.',
    detailedUsage: 'Cada sólido platónico codifica su suma total angular dividida por 10 en escala 432 Hz: Tetraedro (720°→72 Hz), Octaedro (1440°→144 Hz), Cubo (2160°→216 Hz), Icosaedro (3600°→360 Hz) y Dodecaedro (6480°→648 Hz), en razones 1 : 2 : 3 : 5 : 9.',
    evidence: 'Platón (Timeo) / Geometría Poliedral Sagrada',
    harmonics: [72, 144, 216, 360, 432, 648],
    cymaticPatternName: 'Cubo de Metatrón (5 Poliedros Anidados)',
    oscillatorsConfig: [
      osc({ f: 72, name: 'Tetraedro (720°/10)', color: '#ef4444', vol: 0.35, y: -0.4 }),
      osc({ f: 144, name: 'Octaedro (1440°/10)', color: '#22d3ee', vol: 0.32, x: -0.5 }),
      osc({ f: 216, name: 'Cubo / Hexaedro (2160°/10)', color: '#4ade80', vol: 0.35 }),
      osc({ f: 360, name: 'Icosaedro (3600°/10)', color: '#38bdf8', vol: 0.28, x: 0.5 }),
      osc({ f: 648, name: 'Dodecaedro (6480°/10)', color: '#c084fc', vol: 0.25, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Polifónica 3D (Acorde Platónico Completo)',
      usageMode: 'Reproducir en altavoces estéreo o auriculares para percibir el acorde armónico natural 1:2:3:5:9 en absoluta consonancia matemática.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: 'Razones exactas 1 : 2 : 3 : 5 : 9 (Incluye serie Fibonacci 1, 2, 3, 5)',
      harmonicEquation: 'f_sólido = (Caras × Ángulos_cara) / 10 ∈ {72, 144, 216, 360, 648} Hz',
      naturalObjectResonance: 'Estructuras cristalinas, cápsides virales icosaédricas y fulerenos'
    }
  },
  {
    id: 'num_888_christic',
    hz: '888',
    numericalHz: 888,
    name: 'Octava Solar-Crística 888 (8 × 111 Hz)',
    category: 'numerology',
    description: 'Tripla infinitud armónica 888 Hz = 8 × 111 Hz (Tercera octava de Malta 111 Hz).',
    detailedUsage: 'En gematría helénica e investigación armónica, 888 representa la abundancia armónica superior y la tercera octava exacta del tono megalítico 111 Hz (111 × 2³ = 888 Hz).',
    evidence: 'Tradición Pitagórica & Gematría Armónica',
    harmonics: [111, 222, 444, 888, 1776],
    cymaticPatternName: 'Octagrama Solar de 8 Lemniscatas',
    oscillatorsConfig: [
      osc({ f: 888, name: 'Octava 888 Hz (8×111)', color: '#fcd34d', vol: 0.34 }),
      osc({ f: 222, name: 'Base 222 Hz (2×111)', color: '#f59e0b', vol: 0.36 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Luminosa / Contemplación Superior',
      usageMode: 'Usar a volumen suave junto a su sub-octava 222 Hz para evitar fatiga auditiva en el registro de 888 Hz.',
      recommendedVolume: '20% - 35%',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '8 + 8 + 8 = 24 → 6 · 888 = 2 × 444 = 8 × 111 Hz',
      harmonicEquation: 'f = 2³ × 111 Hz = 888 Hz',
      naturalObjectResonance: 'Campanas armónicas afinadas en A=444 Hz y resonadores agudos'
    }
  },

  // =========================================================================
  // 9. ARQUEOACÚSTICA & MEGALITOS (8 partículas)
  // =========================================================================
  {
    id: 'mega_barabar_344',
    hz: '34.4',
    numericalHz: 34.4,
    name: 'Cuevas de Barabar (Sudama & Lomas Rishi · 34.4 Hz)',
    category: 'pyramid',
    description: 'Resonancia estacionaria en granito pulido a espejo mauryano (siglo III a.C.).',
    detailedUsage: 'Las cuevas excavadas en granito macizo de Barabar (Bihar, India) poseen un pulido especular que refleja ~98% de la energía acústica. El modelado láser (Proyecto ALBA) detectó una resonancia estructural fundamental en 34.4 Hz (±0.1 Hz) con colas de reverberación extraordinarias.',
    evidence: 'Proyecto ALBA / Arqueoacústica Mauryana (Cuevas de Barabar)',
    location: 'Bihar, India (Colinas Barabar)',
    harmonics: [34.4, 68.8, 103.2, 137.6],
    cymaticPatternName: 'Cúpula Hemisférica Estacionaria Sudama',
    oscillatorsConfig: [
      osc({ f: 34.4, name: 'Barabar Fundamental 34.4 Hz', color: '#f59e0b', vol: 0.65 }),
      osc({ f: 68.8, name: '2º Armónico Barabar 68.8 Hz', color: '#fbbf24', vol: 0.38 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Subwoofer / Transductor Vibroacústico Profundo',
      usageMode: 'Por estar en 34.4 Hz (borde Gamma bajo / subgrave físico), precisa buenos auriculares cerrados, subwoofer o transductor corporal para sentir la vibración de cámara de granito.',
      recommendedVolume: '38% - 58% (~58 dB)',
      recommendedDuration: '20 - 40 min',
      numerologyRelation: '34.4 Hz × 2 = 68.8 Hz (Coincidencia exacta con Göbekli Tepe)',
      harmonicEquation: 'f_res = (c / 2L) ≈ 34.4 Hz (L ≈ 5 m cámara / 10 m longitud)',
      naturalObjectResonance: 'Granito pulido a espejo (reflexión ~98%) y cúpulas de Sudama'
    }
  },
  {
    id: 'mega_gobekli_69',
    hz: '68.8',
    numericalHz: 68.8,
    name: 'Göbekli Tepe Recinto D (68.8 Hz)',
    category: 'pyramid',
    description: 'Frecuencia modal de los pilares monolíticos T de 11,500 años (Recinto D).',
    detailedUsage: 'Pruebas arqueoacústicas del SB Research Group sobre el Pilar 18 del Recinto D en Göbekli Tepe revelaron respuestas fundamentales graves en 68–69 Hz (octava exacta del 34.4 Hz de Barabar) y armónicos que envuelven los anillos líticos neolíticos.',
    evidence: 'SB Research Group / Arqueoacústica Neolítica',
    location: 'Şanlıurfa, Turquía (Göbekli Tepe)',
    harmonics: [34.4, 68.8, 110, 137.6, 206.4],
    cymaticPatternName: 'Anillo Megalítico Bipolar T',
    oscillatorsConfig: [
      osc({ f: 68.8, name: 'Pilar 18 Recinto D (68.8 Hz)', color: '#f59e0b', vol: 0.58 }),
      osc({ f: 137.6, name: 'Octava 137.6 Hz', color: '#fcd34d', vol: 0.28 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Grave / Percusión y Canto Armónico',
      usageMode: 'Ideal en altavoces con respuesta grave o mediante canto gutural grave para inducir calma corporal e inmersión ancestral.',
      recommendedVolume: '35% - 55%',
      recommendedDuration: '20 - 35 min',
      numerologyRelation: '68.8 Hz ≈ doble exacto de Barabar 34.4 Hz · mitad de 137.6 Hz (≈ α⁻¹)',
      harmonicEquation: 'f_Pilar18 ≈ 68.8 Hz · 2f ≈ 137.6 Hz',
      naturalObjectResonance: 'Pilares calizos en T de 16 toneladas y recintos circulares'
    }
  },
  {
    id: 'mega_chartres_98',
    hz: '98',
    numericalHz: 98,
    name: 'Catedral de Chartres - Bóveda Gótica & Jarrones Acústicos (98 Hz)',
    category: 'pyramid',
    description: 'Resonancia de piedra caliza gótica, laberinto y vasos acústicos (chelys).',
    detailedUsage: 'La nave de Chartres actúa como una caja de resonancia masiva con tiempos de reverberación prolongados y jarrones cerámicos (*chelys*) empotrados en muros para reforzar frecuencias graves del canto gregoriano (~98 Hz Sol2 y ~196 Hz Sol3).',
    evidence: 'Acústica Arquitectónica Medieval / Geometría de Chartres',
    location: 'Chartres, Francia (Catedral de Notre-Dame)',
    harmonics: [98, 196, 294, 392],
    cymaticPatternName: 'Laberinto de Chartres (11 Círculos Concéntricos)',
    oscillatorsConfig: [
      osc({ f: 98, name: 'Bóveda Chartres 98 Hz (Sol2)', color: '#f59e0b', vol: 0.5 }),
      osc({ f: 196, name: 'Octava Coral 196 Hz (Sol3)', color: '#fbbf24', vol: 0.35 }),
      osc({ f: 294, name: 'Quinta Gótica 294 Hz (Re4)', color: '#fcd34d', vol: 0.22 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Reverberante / Canto Coral Sagrado',
      usageMode: 'Reproducir en ambiente tranquilo para meditación caminada o contemplación acústica profunda.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Acorde modal puro 1 : 2 : 3 (98 : 196 : 294 Hz)',
      naturalObjectResonance: 'Bóvedas de crucería de piedra caliza y jarrones resonadores Helmholtz'
    }
  },
  {
    id: 'mega_newgrange_110',
    hz: '110',
    numericalHz: 110,
    name: 'Túmulo Megalítico de Newgrange (110 Hz)',
    category: 'pyramid',
    description: 'Cámara cruciforme neolítica (3200 a.C.) con ondas estacionarias a 110 Hz.',
    detailedUsage: 'Investigado por Robert Jahn y Paul Devereux (Universidad de Princeton / PEAR): el corredor y cámara de Newgrange resuenan fuertemente en 110 Hz (dentro del rango vocal masculino grave), modulando el córtex prefrontal hacia estados de trance intuitivo.',
    evidence: 'Robert Jahn & Paul Devereux (Princeton PEAR Archaeoacoustics)',
    location: 'Valle del Boyne, Irlanda (Newgrange)',
    harmonics: [55, 110, 220, 330, 440],
    cymaticPatternName: 'Cámara Cruciforme Espiral Celta',
    oscillatorsConfig: [
      osc({ f: 110, name: 'Cámara Newgrange 110 Hz', color: '#f59e0b', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Vocal Grave / Cámara Resonante',
      usageMode: 'Cantar o entonar suavemente sobre la nota La2 (110 Hz) sincronizado con el oscilador amplifica la resonancia craneal y torácica.',
      recommendedVolume: '32% - 50%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f_cámara = 110 Hz (La2) · Sub-octava 55 Hz',
      naturalObjectResonance: 'Ortostatos de grauvaca y cuarzo blanco de Newgrange'
    }
  },
  {
    id: 'mega_111',
    hz: '111',
    numericalHz: 111,
    name: 'Hipogeo de Malta - Resonancia Cuántica (111 Hz)',
    category: 'pyramid',
    description: 'Arqueoacústica del oráculo de Malta y modulación prefrontal derecha.',
    detailedUsage: 'Frecuencia de resonancia medida en la Sala del Oráculo del Hipogeo de Ħal Saflieni (Malta). Estudios EEG sugieren que 110–111 Hz reduce la dominancia analítica verbal izquierda favoreciendo el procesamiento emocional e intuitivo.',
    evidence: 'Dr. Paul Devereux / Dr. Ian Cook (UCLA EEG Archaeoacoustics)',
    location: 'Paola, Malta (Hipogeo de Ħal Saflieni)',
    harmonics: [111, 222, 333, 444, 888],
    cymaticPatternName: 'Nicho Oracular Triple (111 Hz)',
    oscillatorsConfig: [
      osc({ f: 111, name: 'Oráculo Malta 111 Hz', color: '#f59e0b', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental / Resonancia Craneal 111 Hz',
      usageMode: 'Ideal como sonido de fondo contemplativo, meditación silenciosa o entonación vocal.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '15 - 35 min',
      numerologyRelation: '111 es el paso constante de toda la escala Solfeggio (+111 Hz)',
      harmonicEquation: 'f = 111 Hz · 111 × 2³ = 888 Hz · Δ_Solfeggio = 111 Hz',
      naturalObjectResonance: 'Caliza coralina subterránea del Hipogeo de Malta'
    }
  },
  {
    id: 'mega_stonehenge',
    hz: '117.5',
    numericalHz: 117.5,
    name: 'Círculo de Piedras - Stonehenge (117.5 Hz)',
    category: 'pyramid',
    description: 'Resonancia entre bloques de arenisca sarsen y bluestone.',
    detailedUsage: 'Frecuencia modal de cavidad y batido acústico registrado en el anillo interior de trilitos de Stonehenge durante mediciones arqueoacústicas.',
    evidence: 'Archaeoacoustics Project / Rupert Till (University of Huddersfield)',
    location: 'Wiltshire, Reino Unido (Stonehenge)',
    harmonics: [58.75, 117.5, 235, 352.5],
    cymaticPatternName: 'Anillo de 30 Pilares Sarsen',
    oscillatorsConfig: [
      osc({ f: 117.5, name: 'Trilitos Stonehenge 117.5 Hz', color: '#f59e0b', vol: 0.55 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Ambiental / Percusión Ceremonial',
      usageMode: 'Reproducción ambiental cálida en altavoces para arraigo y concentración contemplativa.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 35 min',
      harmonicEquation: 'f = 117.5 Hz (Cercano a La#2) · 2f = 235 Hz',
      naturalObjectResonance: 'Arenisca sarsen y dolerita bluestone de Preseli'
    }
  },
  {
    id: 'mega_giza',
    hz: '432',
    numericalHz: 432,
    name: 'Cámara del Rey - Gran Pirámide de Giza (432 Hz)',
    category: 'pyramid',
    description: 'Resonancia del cofre de granito rojo rico en cuarzo y geometría piramidal.',
    detailedUsage: 'La Cámara del Rey de la Gran Pirámide actúa como resonador acústico de granito rojo con alto contenido de cuarzo piezoeléctrico, sintonizado armónicamente con 432 Hz y sus sub-armónicos (108, 144, 216 Hz).',
    evidence: 'Christopher Dunn (The Giza Power Plant) / Flinders Petrie',
    location: 'Meseta de Giza, Egipto',
    harmonics: [108, 144, 216, 432, 864],
    cymaticPatternName: 'Octaedro Cuántico de Granito (432 Hz)',
    oscillatorsConfig: [
      osc({ f: 432, name: 'Cámara del Rey 432 Hz', color: '#fbbf24', vol: 0.45 }),
      osc({ f: 108, name: 'Sub-Armónico Granito 108 Hz', color: '#f59e0b', vol: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Armónica / Campo Resonante Piramidal',
      usageMode: 'Excelente como sonido de fondo universal para meditación, armonización de espacios y estudio.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '20 - 60 min',
      numerologyRelation: '432² = 186,624 (Velocidad de la luz en millas/s ≈ 186,282) · 4+3+2=9',
      harmonicEquation: 'f_Giza = 432 Hz = 2⁴ × 3³ Hz · Sub-armónicos {216, 144, 108} Hz',
      naturalObjectResonance: 'Granito rojo de Asuán rico en cuarzo y cavidad rectangular 2:1'
    }
  },
  {
    id: 'mega_bosnia_28400',
    hz: '28400',
    numericalHz: 28400,
    name: 'Pirámide del Sol de Bosnia (Haz Ultrasónico 28.4 kHz)',
    category: 'pyramid',
    description: 'Señal ultrasónica reportada en la cúspide de Visoko (28.4 kHz + 7.83 Hz).',
    detailedUsage: 'Investigadores del SB Research Group (Paolo Debertolis, Slobodan Mizdrak) reportaron en la colina piramidal de Visoko un haz electromagnético/ultrasónico continuo centrado en ~28.4 kHz junto a alta concentración de iones negativos. Se sintetizan sus sub-octavas audibles exactas (3.55 / 7.1 / 14.2 kHz) y 7.83 Hz.',
    evidence: 'Paolo Debertolis / Slobodan Mizdrak (SB Research Group)',
    location: 'Visoko, Bosnia-Herzegovina',
    harmonics: [7.83, 3550, 7100, 14200, 28400],
    cymaticPatternName: 'Vértice Ultrasónico Estacionario 28.4 kHz',
    oscillatorsConfig: [
      osc({ f: 3550, name: 'Sub-Octava Bosnia /8 (3.55 kHz)', color: '#f59e0b', vol: 0.22, x: -0.35 }),
      osc({ f: 7100, name: 'Sub-Octava Bosnia /4 (7.10 kHz)', color: '#fbbf24', vol: 0.16, x: 0.35 }),
      osc({ f: 14200, name: 'Sub-Octava Bosnia /2 (14.20 kHz)', color: '#fde68a', vol: 0.1 }),
      osc({ f: 7.83, name: 'Base Schumann Visoko 7.83 Hz', color: '#22d3ee', vol: 0.55, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'ionica_plasma', 'acustica'],
      primaryMediumLabel: 'Antena PEMF / Transductor Ultrasónico 28.4 kHz + Sub-Octavas',
      usageMode: '28.4 kHz está en ultrasonido puro (inaudible por aire y filtrado sobre 18 kHz); usar antena PEMF o ionizador/plasma si se busca emisión directa, o reproducir a bajo volumen sus octavas armónicas 3.55 / 7.1 kHz.',
      frequencyScales: {
        hz: '28,400 Hz (Sub-octavas 3550 / 7100 / 14200 Hz)',
        khz: '28.400 kHz',
        mhz: '1.818 MHz (×2⁶)',
        opticalNm: '614 nm (Naranja Ámbar)'
      },
      recommendedVolume: '10% - 24% (Sub-octavas)',
      recommendedVoltage: '5 V - 15 V DC (Transductor / PEMF)',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 10 W',
      recommendedDuration: '15 - 25 min',
      numerologyRelation: '28.4 kHz ÷ 2⁸ = 110.94 Hz (¡Prácticamente Malta/Newgrange 111 Hz!)',
      harmonicEquation: 'f_Bosnia = 28,400 Hz ≈ 2⁸ × 111 Hz (28,416 Hz)',
      naturalObjectResonance: 'Conglomerado geológico piramidal y aire ionizado de Visoko'
    }
  },

  // =========================================================================
  // 10. CHAKRAS & VÓRTEX (8 partículas)
  // =========================================================================
  {
    id: 'chak_muladhara',
    hz: '256',
    numericalHz: 256,
    name: 'Chakra Raíz - Muladhara (Do4 Científico)',
    category: 'chakras',
    description: 'Estabilidad física, arraigo y densidad biológica.',
    detailedUsage: 'Tono Do Científico (2⁸ Hz = 256 Hz, base de A=432 Hz en afinación justa). Alinea la base de la columna vertebral y fortalece el arraigo somático.',
    evidence: 'Giuseppe Verdi / Scientific Pitch Tuning',
    harmonics: [128, 256, 512, 1024, 4096],
    cymaticPatternName: 'Loto Cuadrado de 4 Pétalos (Muladhara)',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Muladhara Do 256 Hz', color: '#ef4444', vol: 0.52 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental / Diapasón 256 Hz',
      usageMode: 'Ideal como sonido de fondo calmante o aplicando vibración en la base sacra.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: '256 = 2⁸ (Octava científica pura del cosmos binario)',
      harmonicEquation: 'f = 2⁸ Hz = 256 Hz',
      naturalObjectResonance: 'Plexo pélvico, hueso sacro y sistema óseo'
    }
  },
  {
    id: 'chak_svadhisthana',
    hz: '288',
    numericalHz: 288,
    name: 'Chakra Sacro - Svadhisthana (Re4)',
    category: 'chakras',
    description: 'Vitalidad creativa, fluidez emocional y circulación.',
    detailedUsage: 'Segunda mayor pitagórica exacta 9:8 respecto a Do 256 Hz (256 × 9/8 = 288 Hz). Regula el equilibrio hídrico y emocional.',
    evidence: 'Afinación Pitagórica Justa',
    harmonics: [144, 288, 576, 864],
    cymaticPatternName: 'Loto Creciente de 6 Pétalos (Svadhisthana)',
    oscillatorsConfig: [
      osc({ f: 288, name: 'Svadhisthana Re 288 Hz', color: '#fb923c', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Suave / Flujo Creativo',
      usageMode: 'Sonido de fondo suave para desbloqueo creativo y armonía emocional.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f = 256 × (9/8) = 288 Hz',
      naturalObjectResonance: 'Plexo hipogástrico, fluidos linfáticos y gónadas'
    }
  },
  {
    id: 'chak_manipura',
    hz: '320',
    numericalHz: 320,
    name: 'Chakra Plexo Solar - Manipura (Mi4)',
    category: 'chakras',
    description: 'Poder personal, digestión y metabolismo energético.',
    detailedUsage: 'Tercera mayor justa 5:4 sobre 256 Hz (256 × 5/4 = 320 Hz). Fortalece la vitalidad digestiva y claridad de propósito.',
    evidence: 'Sistema Bioenergético / Entonación Justa',
    harmonics: [160, 320, 640, 960],
    cymaticPatternName: 'Triángulo Ígneo de 10 Pétalos (Manipura)',
    oscillatorsConfig: [
      osc({ f: 320, name: 'Manipura Mi 320 Hz', color: '#facc15', vol: 0.48 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Ambiental / Respiración Abdominal',
      usageMode: 'Escuchar durante meditación solar matutina o respiración abdominal profunda.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f = 256 × (5/4) = 320 Hz',
      naturalObjectResonance: 'Plexo celíaco, estómago y diafragma'
    }
  },
  {
    id: 'chak_anahata',
    hz: '341.33',
    numericalHz: 341.33,
    name: 'Chakra Corazón - Anahata (Fa4)',
    category: 'chakras',
    description: 'Compasión, glándula timo y coherencia electrocardíaca.',
    detailedUsage: 'Cuarta perfecta justa 4:3 sobre Do 256 Hz (256 × 4/3 = 341.33 Hz). Abre la cavidad torácica y armoniza el campo electromagnético del corazón.',
    evidence: 'Escala Armónica Justa / HeartMath Coherence',
    harmonics: [170.67, 341.33, 682.66, 1024],
    cymaticPatternName: 'Hexagrama Estrellado de 12 Pétalos (Anahata)',
    oscillatorsConfig: [
      osc({ f: 341.33, name: 'Anahata Fa 341.33 Hz', color: '#4ade80', vol: 0.48 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Armónica / Coherencia Torácica',
      usageMode: 'Ideal como sonido de fondo para meditación de compasión y respiración cardíaca.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: 'f = 256 × (4/3) = 341.333 Hz',
      naturalObjectResonance: 'Glándula timo, corazón y plexo cardíaco'
    }
  },
  {
    id: 'chak_vishuddha',
    hz: '384',
    numericalHz: 384,
    name: 'Chakra Garganta - Vishuddha (Sol4)',
    category: 'chakras',
    description: 'Expresión auténtica, laringe y equilibrio tiroideo.',
    detailedUsage: 'Quinta justa 3:2 respecto a Do 256 Hz (256 × 3/2 = 384 Hz). Coincide además con la octava justa del ciclo sinódico lunar en tradiciones védicas.',
    evidence: 'Escala Armónica Justa Pitagórica',
    harmonics: [192, 384, 768, 1152],
    cymaticPatternName: 'Círculo Éter de 16 Pétalos (Vishuddha)',
    oscillatorsConfig: [
      osc({ f: 384, name: 'Vishuddha Sol 384 Hz', color: '#38bdf8', vol: 0.46 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Vocal / Entonación Armónica',
      usageMode: 'Acompañar suavemente con vocalizaciones abiertas ("Ham" / "Ah") a volumen moderado.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f = 256 × (3/2) = 384 Hz',
      naturalObjectResonance: 'Cuerdas vocales, tiroides y faringe'
    }
  },
  {
    id: 'chak_ajna',
    hz: '426.66',
    numericalHz: 426.66,
    name: 'Chakra Tercer Ojo - Ajna (La4 Justo)',
    category: 'chakras',
    description: 'Visión intuitiva, pituitaria e integración perceptual.',
    detailedUsage: 'Sexta mayor justa 5:3 sobre Do 256 Hz (256 × 5/3 = 426.67 Hz). Estimula la atención interna silenciosa y el lóbulo frontal.',
    evidence: 'Sistema Védico de Tonos / Entonación Justa',
    harmonics: [213.33, 426.66, 853.33, 1280],
    cymaticPatternName: 'Loto Dual de 2 Pétalos (Ajna)',
    oscillatorsConfig: [
      osc({ f: 426.66, name: 'Ajna La 426.66 Hz', color: '#818cf8', vol: 0.45 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_uv'],
      primaryMediumLabel: 'Acústica Meditativa / Contemplación Visual',
      usageMode: 'Reproducir a volumen bajo-suave con ojos cerrados en ambiente silencioso.',
      recommendedVolume: '22% - 40%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f = 256 × (5/3) = 426.667 Hz',
      naturalObjectResonance: 'Glándula pituitaria y quiasma óptico'
    }
  },
  {
    id: 'chak_sahasrara',
    hz: '480',
    numericalHz: 480,
    name: 'Chakra Corona - Sahasrara (Si4)',
    category: 'chakras',
    description: 'Unidad cósmica, corteza superior y glándula pineal.',
    detailedUsage: 'Séptima mayor justa 15:8 sobre Do 256 Hz (256 × 15/8 = 480 Hz). Culmina la escala védica de siete chakras en consonancia armónica pura.',
    evidence: 'Escala Védica de Entonación Justa',
    harmonics: [240, 480, 960, 1440],
    cymaticPatternName: 'Loto de Mil Pétalos (Sahasrara)',
    oscillatorsConfig: [
      osc({ f: 480, name: 'Sahasrara Si 480 Hz', color: '#e879f9', vol: 0.42 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ligera / Silencio Contemplativo',
      usageMode: 'Mantener volumen suave como fondo meditativo de apertura y quietud mental.',
      recommendedVolume: '20% - 38%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: 'f = 256 × (15/8) = 480 Hz',
      naturalObjectResonance: 'Glándula pineal y fontanela craneal superior'
    }
  },
  {
    id: 'chak_alta_mayor_4096',
    hz: '4096',
    numericalHz: 4096,
    name: 'Octava Estelar · Sintonizador de Cristal ("Angel Tuner" 4096 Hz)',
    category: 'chakras',
    description: 'Cuarta octava superior de Do 256 Hz (2¹² Hz) para limpieza áurica y cristalina.',
    detailedUsage: 'El sintonizador estándar de 4096 Hz (2¹² Hz) es exactamente 4 octavas arriba del Chakra Raíz 256 Hz. Se emplea sin contacto corporal, en el campo espacial o sobre cristales de cuarzo para despejar densidad mental.',
    evidence: 'Terapia de Diapasones BioSonic / Geometría Binaria 2¹²',
    harmonics: [256, 512, 1024, 2048, 4096],
    cymaticPatternName: 'Estrella Crystalline 2¹²',
    oscillatorsConfig: [
      osc({ f: 4096, name: 'Angel Tuner 4096 Hz (2¹²)', color: '#fef08a', vol: 0.2 }),
      osc({ f: 512, name: 'Octava Anclaje 512 Hz (2⁹)', color: '#facc15', vol: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'fotonica_uv'],
      primaryMediumLabel: 'Acústica Etérea Muy Suave / Diapasón de Cuarzo',
      usageMode: 'Al ser 4096 Hz un tono agudo muy penetrante, usar volumen bajo (≤ 25%) por breves intervalos de 3–10 minutos para despeje espacial.',
      recommendedVolume: '12% - 26% (Nunca alto en auriculares)',
      recommendedDuration: '5 - 12 min',
      numerologyRelation: '4096 = 2¹² = 64² = 16³ (Cubo y cuadrado perfecto)',
      harmonicEquation: 'f = 2¹² Hz = 4096 Hz = 16 × 256 Hz',
      naturalObjectResonance: 'Puntas de cuarzo hialino y campo bioenergético coronal'
    }
  },

  // =========================================================================
  // 11. RITMOS & ISOCRÓNICOS (4 partículas)
  // =========================================================================
  {
    id: 'iso_delta_3',
    hz: '3',
    numericalHz: 3,
    name: 'Pulso Isocrónico Delta 3 Hz',
    category: 'rhythms',
    description: 'Modulación acústica física a 3 Hz para sueño profundo sin auriculares.',
    detailedUsage: 'Utiliza interferencia de amplitud centrada (174 Hz + 177 Hz, Δf = 3 Hz) acompañada de un pulso independiente a 3 Hz, permitiendo el arrastre Delta directo mediante altavoces de habitación.',
    evidence: 'Neuro-Acoustic Entrainment Technology',
    harmonics: [3, 6, 174, 177],
    cymaticPatternName: 'Envolvente Pulsada Trilateral (3 Hz)',
    oscillatorsConfig: [
      osc({ f: 174, name: 'Portadora 174 Hz', color: '#10b981', vol: 0.42 }),
      osc({ f: 177, name: 'Modulador AM +3 Hz', color: '#34d399', vol: 0.42 }),
      osc({ f: 3, name: 'Pulso Isocrónico 3 Hz', type: 'square', color: '#6ee7b7', vol: 0.5, ind: true, cv: 1.6 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Altavoces Ambientales (Sin Auriculares) / Bobina Nocturna',
      usageMode: 'La pareja centrada 174 + 177 Hz produce un batido físico real de 3 pulsos/segundo en el aire de la habitación, ideal para altavoces antes de dormir.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '25 - 60 min',
      harmonicEquation: 'Δf_AM = 177 − 174 = 3.0 Hz',
      naturalObjectResonance: 'Ritmos respiratorios profundos y sueño no-REM'
    }
  },
  {
    id: 'iso_theta_pulse',
    hz: '6',
    numericalHz: 6,
    name: 'Pulso Isocrónico Theta 6 Hz',
    category: 'rhythms',
    description: 'Ritmo de modulación para meditación vívida y sueños lúcidos.',
    detailedUsage: 'Envolvente rítmica física de 6 ciclos por segundo creada por interferencia de amplitud centrada (216 Hz + 222 Hz) sin necesidad de auriculares estéreo.',
    evidence: 'Neuro-Acoustic Entrainment',
    harmonics: [6, 12, 216, 222],
    cymaticPatternName: 'Hexágono Pulsátil Rítmico (6 Hz)',
    oscillatorsConfig: [
      osc({ f: 216, name: 'Portadora 216 Hz', color: '#10b981', vol: 0.42 }),
      osc({ f: 222, name: 'Modulador AM +6 Hz', color: '#34d399', vol: 0.42 }),
      osc({ f: 6, name: 'Pulso Theta 6 Hz', type: 'square', color: '#6ee7b7', vol: 0.5, ind: true, cv: 1.6 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Altavoces de Sala o Auriculares (Modulación AM 6 Hz)',
      usageMode: 'No requiere separación L/R estricta: funciona tanto en altavoces ambientales como en auriculares para visualización guiada.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: 'Δf_AM = 222 − 216 = 6.0 Hz',
      naturalObjectResonance: 'Estados hipnagógicos y ritmo theta hipocampal'
    }
  },
  {
    id: 'iso_alpha_pulse',
    hz: '10',
    numericalHz: 10,
    name: 'Pulso Isocrónico Alfa 10 Hz',
    category: 'rhythms',
    description: 'Pulsación acústica rítmica para sincronización hemisférica sin auriculares.',
    detailedUsage: 'Genera una modulación de amplitud acústica directa de 10 Hz mediante superposición centrada (256 Hz + 266 Hz) más un pulso de envolvente a 10 Hz.',
    evidence: 'Brainwave Entrainment Technology',
    harmonics: [10, 20, 256, 266],
    cymaticPatternName: 'Anillo Pulsante Decagonal (10 Hz)',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Portadora 256 Hz', color: '#10b981', vol: 0.42 }),
      osc({ f: 266, name: 'Modulador AM +10 Hz', color: '#34d399', vol: 0.42 }),
      osc({ f: 10, name: 'Pulso Isocrónico 10 Hz', type: 'square', color: '#6ee7b7', vol: 0.5, ind: true, cv: 1.65 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Altavoces de Escritorio (Sin Auriculares)',
      usageMode: 'Excelente como ritmo de estudio, lectura creativa o relajación alerta en altavoces ambientales.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Δf_AM = 266 − 256 = 10.0 Hz',
      naturalObjectResonance: 'Sincronía talámica alfa de vigilia tranquila'
    }
  },
  {
    id: 'iso_gamma_40',
    hz: '40',
    numericalHz: 40,
    name: 'Pulso Isocrónico Gamma 40 Hz (Protocolo MIT GENUS)',
    category: 'rhythms',
    description: 'Modulación audiovisual de 40 pulsos/s para lucidez neural y microglía.',
    detailedUsage: 'Inspirado en los protocolos GENUS de 40 Hz del MIT: la combinación de 256 Hz + 296 Hz centrados produce un trémolo acústico físico de 40 Hz apto para altavoces o sincronización con luz estroboscópica suave a 40 Hz.',
    evidence: 'MIT Picower Institute / Gamma Entrainment Using Sensory Stimulation',
    location: 'MIT Picower Institute (Cambridge)',
    harmonics: [40, 80, 256, 296],
    cymaticPatternName: 'Malla Gamma Isocrónica 40 Hz',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Portadora 256 Hz', color: '#10b981', vol: 0.4 }),
      osc({ f: 296, name: 'Modulador AM +40 Hz', color: '#34d399', vol: 0.4 }),
      osc({ f: 40, name: 'Pulso Gamma 40 Hz', type: 'square', color: '#facc15', vol: 0.5, ind: true, duty: 0.2, cv: 1.7 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['multimedio', 'acustica', 'fotonica_nir'],
      primaryMediumLabel: 'Altavoces + Luz LED Pulsada 40 Hz (Audiovisual)',
      usageMode: 'Muy eficaz en altavoces durante tareas cognitivas o combinado con iluminación ambiental modulada a 40 Hz (no usar luces intermitentes en personas fotosensibles).',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Δf_AM = 296 − 256 = 40.0 Hz',
      naturalObjectResonance: 'Oscilaciones gamma corticales e interneuronas rápidas'
    }
  },

  // =========================================================================
  // 12. PITAGÓRICAS & MICROTONALES (5 partículas)
  // =========================================================================
  {
    id: 'micro_pythagorean_comma',
    hz: '259.49',
    numericalHz: 259.49,
    name: 'Coma Pitagórica (531,441 / 524,288 · 23.46 cents)',
    category: 'microtonal',
    description: 'Discrepancia microtonal exacta entre 12 quintas justas (3/2)¹² y 7 octavas 2⁷.',
    detailedUsage: 'En acústica matemática, apilar 12 quintas puras nunca cierra exactamente con 7 octavas: sobra la razón 531,441/524,288 ≈ 1.013643 (23.46 cents). Sobre Do 256 Hz emerge Si# en 259.49 Hz generando un batido microtonal vivo de 3.49 Hz.',
    evidence: 'Escuela Pitagórica / Acústica Matemática',
    binauralBeatHz: 3.49,
    harmonics: [256, 259.49, 432, 437.89],
    cymaticPatternName: 'Espiral Abierta No-Cerrada (23.46¢)',
    oscillatorsConfig: [
      osc({ f: 256, name: '7 Octavas Puras (256 Hz)', color: '#60a5fa', vol: 0.45, x: -0.5 }),
      osc({ f: 259.49, name: '12 Quintas Pitagóricas (259.49 Hz)', color: '#93c5fd', vol: 0.45, x: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Estéreo o Auriculares (Estudio Microtonal)',
      usageMode: 'Escuchar en estéreo para percibir cómo la diferencia de 23.46 cents (3.49 Hz) crea una pulsación orgánica viva imposible en el temperamento igual moderno.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '10 - 25 min',
      numerologyRelation: '3¹² / 2¹⁹ = 531,441 / 524,288 = 1.01364326 (23.46 cents)',
      harmonicEquation: 'κ_P = (3/2)¹² / 2⁷ = 531,441 / 524,288 ≈ 1.013643',
      naturalObjectResonance: 'Círculo de quintas abierto y temperamentos históricos de órgano'
    }
  },
  {
    id: 'micro_just_intonation_5_4',
    hz: '320',
    numericalHz: 320,
    name: 'Tercera Mayor Justa Pura (5:4 · Libre de Batidos)',
    category: 'microtonal',
    description: 'Intervalo armónico puro 5:4 (256 + 320 Hz), 13.7 cents más dulce que el piano moderno.',
    detailedUsage: 'En afinación temperada igual (12-TET), la tercera mayor es 13.7 cents más ancha y genera aspereza. En Entonación Justa (5:4 = 320 Hz sobre 256 Hz), los armónicos coinciden en fase absoluta sin batidos disonantes.',
    evidence: 'Hermann von Helmholtz / Just Intonation Theory',
    harmonics: [256, 320, 512, 640, 1280],
    cymaticPatternName: 'Figura de Lissajous 5:4 Cerrada',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Tónica Justa 4×64 (256 Hz)', color: '#60a5fa', vol: 0.45, x: -0.4 }),
      osc({ f: 320, name: 'Tercera Justa 5×64 (320 Hz)', color: '#38bdf8', vol: 0.45, x: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica de Alta Fidelidad (Entonación Pura)',
      usageMode: 'Excelente como sonido de fondo contemplativo y armonía coral libre de aspereza temperada.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'f₂ / f₁ = 320 / 256 = 5 / 4 (386.31 cents exactos)',
      naturalObjectResonance: 'Series de armónicos naturales en cuerdas vibrantes y tubos abiertos'
    }
  },
  {
    id: 'pit_432',
    hz: '432',
    numericalHz: 432,
    name: 'A=432 Hz - La Afinación Natural de Verdi',
    category: 'microtonal',
    description: 'Afinación matemática en coherencia con potencias de 2 y 3 (2⁴ × 3³).',
    detailedUsage: 'Estándar defendido por Giuseppe Verdi y el Instituto Schiller. Al fijar La4=432 Hz, Do4 cae exactamente en 256 Hz (2⁸ Hz) en entonación justa pitagórica, alineando la música con proporciones naturales.',
    evidence: 'Giuseppe Verdi / Schiller Institute',
    harmonics: [108, 216, 432, 864, 1296],
    cymaticPatternName: 'Mandala Fractal Pitagórico 432',
    oscillatorsConfig: [
      osc({ f: 432, name: 'Verdi A=432 Hz', color: '#60a5fa', vol: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental / Estándar de Afinación Musical',
      usageMode: 'Ideal como tono de referencia para afinar instrumentos, cantar o mantener en fondo ambiental suave.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '20 - 60 min',
      numerologyRelation: '432 = 2⁴ × 3³ · 4 + 3 + 2 = 9',
      harmonicEquation: 'f = 2⁴ · 3³ = 432 Hz · (432 / 440 = −31.77 cents)',
      naturalObjectResonance: 'Cuerdas armónicas, cámaras de piedra y cristales líquidos'
    }
  },
  {
    id: 'pit_444',
    hz: '444',
    numericalHz: 444,
    name: 'A=444 Hz - Clave Armónica de Do5 = 528 Hz',
    category: 'microtonal',
    description: 'Afinación temperada que coloca exactamente la nota Do5 en 528 Hz.',
    detailedUsage: 'Utilizada por músicos e investigadores sonoros porque en temperamento igual (A4 = 444 Hz), la nota C5 equivale a 444 × 2^(3/12) = 527.997 ≈ 528 Hz, unificando la música moderna con el Solfeggio MI.',
    evidence: 'Dr. David Hulse / Sound Therapy Tuning',
    harmonics: [111, 222, 444, 528, 888],
    cymaticPatternName: 'Simetría Hexagonal en Clave 528',
    oscillatorsConfig: [
      osc({ f: 444, name: 'Referencia La4 = 444 Hz', color: '#60a5fa', vol: 0.42, x: -0.35 }),
      osc({ f: 528, name: 'Do5 Resultante = 528 Hz', color: '#4ade80', vol: 0.35, x: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Musical / Referencia Instrumental',
      usageMode: 'Perfecta como afinación de referencia para sintetizadores, guitarras o cuencos afinados en 528 Hz.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: '4 + 4 + 4 = 12 → 3 · 444 = 4 × 111 Hz',
      harmonicEquation: 'C₅ = 444 × 2^(3/12) = 527.997 Hz ≈ 528 Hz',
      naturalObjectResonance: 'Cuerdas afinadas y armónicos de tercera menor'
    }
  },
  {
    id: 'micro_bohlen_pierce',
    hz: '144-240-336-432',
    numericalHz: 432,
    name: 'Escala Bohlen–Pierce (Tritava 3:1 · Acorde Impar 3:5:7)',
    category: 'microtonal',
    description: 'Sistema microtonal no-octavante basado en la tritava 3:1 y armónicos impares.',
    detailedUsage: 'En lugar de repetir cada octava (2:1), la escala Bohlen-Pierce repite cada Tritava (3:1, una octava más una quinta) dividida en 13 pasos iguales (~146.3 cents) y utiliza acordes de armónicos estrictamente impares 3:5:7 (aquí 144 : 240 : 336 : 432 Hz).',
    evidence: 'Heinz Bohlen (1974) / John R. Pierce & Max Mathews',
    harmonics: [48, 144, 240, 336, 432],
    cymaticPatternName: 'Simetría Impar de 13 Pasos (Tritava 3:1)',
    oscillatorsConfig: [
      osc({ f: 144, name: 'BP Armónico 3 (144 Hz)', color: '#60a5fa', vol: 0.42, x: -0.5 }),
      osc({ f: 240, name: 'BP Armónico 5 (240 Hz)', color: '#818cf8', vol: 0.38 }),
      osc({ f: 336, name: 'BP Armónico 7 (336 Hz)', color: '#38bdf8', vol: 0.35, x: 0.5 }),
      osc({ f: 432, name: 'BP Tritava 3:1 (432 Hz)', color: '#c084fc', vol: 0.32, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Experimental / Síntesis Microtonal',
      usageMode: 'Reproducir en estéreo o auriculares para experimentar una armonía completamente ajena a la octava 2:1 tradicional, ideal para clarinetes y ondas puras.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '15 - 30 min',
      numerologyRelation: 'Tríada 3 : 5 : 7 y Tritava 9 : 3 (3:1) dividida en 13 microtonos',
      harmonicEquation: 'f_k = f₀ · 3^(k/13) · Acorde puro 3:5:7 = 144 : 240 : 336 Hz',
      naturalObjectResonance: 'Tubos cilíndricos cerrados (clarinete) con supresión de armónicos pares'
    }
  },

  // =========================================================================
  // 13. MÚSICA SAGRADA (5 partículas)
  // =========================================================================
  {
    id: 'mus_om_cosmic_drone',
    hz: '136.10-204.15',
    numericalHz: 136.1,
    name: 'Drone Védico OM & Quinta Tanpura (136.10 + 204.15 Hz)',
    category: 'music',
    description: 'Bordón tradicional hindú (Sa–Pa) afinado en el Año Terrestre OM (136.10 Hz).',
    detailedUsage: 'Replica la estructura fundamental Sa–Pa (tónica y quinta justa 3:2) de una tanpura clásica en escala cósmica OM, envolviendo la mente en una estabilidad meditativa atemporal.',
    evidence: 'Musicología Clásica Indostaní / Hans Cousto',
    harmonics: [68.05, 136.1, 204.15, 272.2, 408.3],
    cymaticPatternName: 'Mandala Tanpura Sa–Pa (3:2)',
    oscillatorsConfig: [
      osc({ f: 136.1, name: 'Sa (Tónica OM 136.10 Hz)', type: 'triangle', color: '#818cf8', vol: 0.48, x: -0.35 }),
      osc({ f: 204.15, name: 'Pa (Quinta Justa 204.15 Hz)', type: 'sine', color: '#6366f1', vol: 0.36, x: 0.35 }),
      osc({ f: 272.2, name: 'Sa Superior (272.20 Hz)', type: 'sine', color: '#a5b4fc', vol: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Ambiental / Canto Mantra y Yoga',
      usageMode: 'Excelente como fondo continuo para meditación, pranayama o acompañamiento vocal.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 60 min',
      harmonicEquation: 'f_Pa / f_Sa = 204.15 / 136.10 = 3 / 2 (Quinta Justa)',
      naturalObjectResonance: 'Cuerdas resonantes de tanpura de calabaza y caja torácica'
    }
  },
  {
    id: 'mus_tibetan_bowl_doublets',
    hz: '113.7-114.3',
    numericalHz: 114,
    name: 'Cuenco Tibetano de Bronce · Dobletes Modales (Cu/Sn 80/20)',
    category: 'music',
    description: 'División modal asimétrica natural (113.7 + 114.3 Hz) de cuencos martillados a mano.',
    detailedUsage: 'Los cuencos himalayos de bronce campanil (80% Cu, 20% Sn) no son perfectamente simétricos al ser forjados a mano: cada modo vibracional se divide en dos frecuencias ortogonales muy cercanas (dobletes), generando batidos lentos e hipnóticos (0.6 Hz y 1.4 Hz).',
    evidence: 'Física Acústica de Cuencos Tibetanos (Inácio, Henrique & Antunes)',
    location: 'Región del Himalaya (Bronce Campanil Martillado)',
    binauralBeatHz: 0.6,
    harmonics: [113.7, 114.3, 318.2, 319.6],
    cymaticPatternName: 'Nodos Cuadripolares Ortogonales (Doblete)',
    oscillatorsConfig: [
      osc({ f: 113.7, name: 'Modo A Fundamental (113.7 Hz)', color: '#818cf8', vol: 0.46, x: -0.4 }),
      osc({ f: 114.3, name: 'Modo B Ortogonal (114.3 Hz)', color: '#6366f1', vol: 0.46, x: 0.4 }),
      osc({ f: 318.2, name: 'Sobretono A (318.2 Hz)', color: '#a5b4fc', vol: 0.25, x: -0.25 }),
      osc({ f: 319.6, name: 'Sobretono B (319.6 Hz)', color: '#c7d2fe', vol: 0.25, x: 0.25 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Envolvente / Baño de Sonido Estéreo',
      usageMode: 'Reproducir en altavoces o auriculares para sentir el trémolo natural de un cuenco himalayo de bronce real sin fatiga auditiva.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: 'Δf₁ = 0.6 Hz (Pulso Epsilon) · Δf₂ = 1.4 Hz (Pulso Delta)',
      harmonicEquation: 'f_doblete = f₀ ± Δf_asimetría · Aleación Cu₈₀Sn₂₀',
      naturalObjectResonance: 'Cáscara resonante de bronce campanil y agua en cuenco'
    }
  },
  {
    id: 'mus_verdi_c_256',
    hz: '256-512',
    numericalHz: 256,
    name: 'Octava Científica Do 256–512 Hz (Resonancia Binaria)',
    category: 'music',
    description: 'Diapente binario puro 2⁸ y 2⁹ Hz de la escala filosófica-científica.',
    detailedUsage: 'Establece una consonancia de octava absoluta (2:1) entre Do4 (256 Hz) y Do5 (512 Hz) con transparencia acústica total para limpieza mental y estudio musical.',
    evidence: 'Joseph Sauveur / Giuseppe Verdi Scientific Pitch',
    harmonics: [128, 256, 512, 1024],
    cymaticPatternName: 'Octava Binaria Concéntrica (2:1)',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Do4 Científico (256 Hz)', color: '#818cf8', vol: 0.48, x: -0.3 }),
      osc({ f: 512, name: 'Do5 Octava (512 Hz)', color: '#60a5fa', vol: 0.32, x: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Pura / Enfoque y Afinación',
      usageMode: 'Muy limpia como fondo continuo de lectura, concentración o descanso mental.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 50 min',
      harmonicEquation: 'f₁ = 2⁸ Hz = 256 Hz · f₂ = 2⁹ Hz = 512 Hz',
      naturalObjectResonance: 'Diapasones físicos de laboratorio y resonadores cilíndricos'
    }
  },
  {
    id: 'mus_solfeggio_choral_432',
    hz: '288-384-432',
    numericalHz: 432,
    name: 'Tetracordio Sagrado Pitagórico (1 : 9/8 : 4/3 : 3/2)',
    category: 'music',
    description: 'Proporciones fundacionales de la música modal griega y canto gregoriano.',
    detailedUsage: 'Basado en Do=256 Hz: Unísono (256 Hz), Segunda Mayor 9/8 (288 Hz), Cuarta Justa 4/3 (341.33 Hz) y Quinta Justa 3/2 (384 Hz) coronadas en 432 Hz. Produce reposo arquitectónico y solemnidad.',
    evidence: 'Filolao / Boecio (De Institutione Musica)',
    harmonics: [256, 288, 341.33, 384, 432],
    cymaticPatternName: 'Tetraktys Pitagórico (1:2:3:4)',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Tónica 1:1 (256 Hz)', color: '#818cf8', vol: 0.38, x: -0.5 }),
      osc({ f: 288, name: 'Segunda 9:8 (288 Hz)', color: '#6366f1', vol: 0.22, x: -0.2 }),
      osc({ f: 341.33, name: 'Cuarta 4:3 (341.33 Hz)', color: '#38bdf8', vol: 0.3, x: 0.2 }),
      osc({ f: 384, name: 'Quinta 3:2 (384 Hz)', color: '#c084fc', vol: 0.34, x: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Polifónica / Coro y Contemplación',
      usageMode: 'Reproducir en altavoces estéreo para crear una atmósfera modal gregoriana/pitagórica de gran amplitud espacial.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Tetracordio = {1, 9/8, 4/3, 3/2} × 256 Hz',
      naturalObjectResonance: 'Monocordio pitagórico y acústica coral en piedra'
    }
  },
  {
    id: 'mus_cathedral_bell_partials',
    hz: '108-216-259.2-324-432',
    numericalHz: 216,
    name: 'Campana de Bronce Clásica · Serie Hum–Prime–Tierce–Quint–Nominal',
    category: 'music',
    description: 'Estructura campanológica exacta de 5 parciales (0.5 : 1.0 : 1.2 : 1.5 : 2.0).',
    detailedUsage: 'Una campana de catedral bien torneada ordena sus cinco modos principales sobre un Prime (aquí 216 Hz) en: Hum (108 Hz, 0.5×), Prime (216 Hz, 1×), Tierce menor 6:5 (259.2 Hz, 1.2×), Quint 3:2 (324 Hz, 1.5×) y Nominal (432 Hz, 2×).',
    evidence: 'Campanología Acústica Europea (Fletcher & Rossing)',
    harmonics: [108, 216, 259.2, 324, 432],
    cymaticPatternName: 'Modos Axiales de Campana Torneada',
    oscillatorsConfig: [
      osc({ f: 108, name: 'Hum 0.5× (108 Hz)', color: '#6366f1', vol: 0.42, y: -0.5 }),
      osc({ f: 216, name: 'Prime 1.0× (216 Hz)', color: '#818cf8', vol: 0.4 }),
      osc({ f: 259.2, name: 'Tierce 6:5 (259.2 Hz)', color: '#a5b4fc', vol: 0.28, x: -0.5 }),
      osc({ f: 324, name: 'Quint 3:2 (324 Hz)', color: '#c084fc', vol: 0.3, x: 0.5 }),
      osc({ f: 432, name: 'Nominal 2.0× (432 Hz)', color: '#fcd34d', vol: 0.26, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Espacial / Simulación de Campana Sagrada',
      usageMode: 'Ideal en altavoces estéreo para crear una resonancia campanológica profunda y envolvente en todo el espacio.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '15 - 35 min',
      numerologyRelation: 'Todos los parciales son armónicos naturales de 432 Hz y 108 Hz',
      harmonicEquation: 'f_campana = 216 Hz × {0.5, 1.0, 1.2, 1.5, 2.0}',
      naturalObjectResonance: 'Campanas de bronce fundido y resonadores cónicos metálicos'
    }
  },

  // =========================================================================
  // 14. SINERGIAS & ECUACIONES MULTI-OSCILADOR (28 partículas: 18 App.tsx + 10 nuevas)
  // =========================================================================
  {
    id: 'syn_phi',
    hz: '432-433.618',
    numericalHz: 432,
    name: 'Sinergia Áurea Binaural (Phi · Δ 1.618 Hz)',
    category: 'synergy',
    description: 'Batido binaural exacto en la proporción áurea φ = 1.618 Hz sobre 432 Hz.',
    detailedUsage: 'Canal izquierdo en 432 Hz y canal derecho en 433.618 Hz. Genera un pulso interaural Delta profundo de 1.618 Hz sincronizando ambos hemisferios en proporción áurea.',
    evidence: 'Geometría Áurea & Neuroacústica Binaural',
    binauralBeatHz: 1.618,
    harmonics: [1.618, 432, 433.618, 864],
    cymaticPatternName: 'Espiral Binaural Áurea φ',
    oscillatorsConfig: [
      osc({ f: 432, name: 'Base Phi (L)', color: '#fbbf24', vol: 0.5, x: -0.8 }),
      osc({ f: 433.618, name: 'Binaural Phi (R)', color: '#f59e0b', vol: 0.5, x: 0.8 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Auriculares Estéreo (Separación Binaural L/R)',
      usageMode: 'Usar audífonos estéreo para que el cerebro sintetice el pulso áureo de 1.618 Hz sin mezcla aérea.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Δf = 433.618 − 432.000 = 1.618 Hz (φ)',
      naturalObjectResonance: 'Sincronía interhemisférica e hipocampo en ondas Delta'
    }
  },
  {
    id: 'syn_pi',
    hz: '432-435.142',
    numericalHz: 432,
    name: 'Sinergia Circular Binaural (Pi · Δ 3.1416 Hz)',
    category: 'synergy',
    description: 'Batido binaural Delta de π (3.1416 Hz) anclado en afinación natural 432 Hz.',
    detailedUsage: 'Canal izquierdo en 432 Hz y derecho en 435.1416 Hz. Produce un pulso Delta medio de π Hz para meditación circular, cierre de ciclos e integración somática.',
    evidence: 'Constante Circular π & Neuroacústica',
    binauralBeatHz: 3.1416,
    harmonics: [3.1416, 432, 435.1416],
    cymaticPatternName: 'Círculo Geodésico π Estacionario',
    oscillatorsConfig: [
      osc({ f: 432, name: 'Base Pi (L)', color: '#3b82f6', vol: 0.5, x: -0.8 }),
      osc({ f: 435.1416, name: 'Binaural Pi (R)', color: '#60a5fa', vol: 0.5, x: 0.8 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Auriculares Estéreo (Binaural π = 3.1416 Hz)',
      usageMode: 'Requiere auriculares estéreo; excelente para meditación profunda antes de dormir.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: 'Δf = 435.1416 − 432.0000 = π Hz (3.1416 Hz)',
      naturalObjectResonance: 'Ritmo Delta profundo cortical'
    }
  },
  {
    id: 'syn_astral',
    hz: '216-220',
    numericalHz: 216,
    name: 'Sinergia Protocolo Astral (Theta 4.0 Hz)',
    category: 'synergy',
    description: 'Binaural Theta profundo de 4 Hz sobre octava grave de Giza (216 Hz L / 220 Hz R).',
    detailedUsage: 'Desacopla la percepción sensorial externa induciendo estados Theta profundos (4.0 Hz), ensueño lúcido y exploración meditativa profunda.',
    evidence: 'Monroe Institute / Protocolos Theta 4 Hz',
    binauralBeatHz: 4.0,
    harmonics: [4, 216, 220, 432],
    cymaticPatternName: 'Puerta Theta Cuadrangular (4 Hz)',
    oscillatorsConfig: [
      osc({ f: 216, name: 'Base Astral (L)', color: '#8b5cf6', vol: 0.5, x: -0.9 }),
      osc({ f: 220, name: 'Theta 4Hz (R)', color: '#a78bfa', vol: 0.5, x: 0.9 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Auriculares Estéreo (Hard Panning ±0.9)',
      usageMode: 'Escuchar recostado con auriculares estéreo en habitación oscura o con antifaz.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '25 - 50 min',
      harmonicEquation: 'Δf = 220 − 216 = 4.0 Hz (Theta profundo)',
      naturalObjectResonance: 'Lóbulo temporal e hipocampo en estado hipnagógico'
    }
  },
  {
    id: 'syn_gaia_matrix',
    hz: '528-7.83',
    numericalHz: 528,
    name: 'Sinergia Matriz Gaia (528 Hz ADN + 7.83 Hz Schumann)',
    category: 'synergy',
    description: 'Fusión biológica de reparación celular 528 Hz anclada al latido terrestre 7.83 Hz.',
    detailedUsage: 'Combina la portadora Solfeggio 528 Hz (octava verde clorofila 516 nm) con la onda independiente terrestre Schumann 7.83 Hz para regeneración celular arraigada a la biosfera.',
    evidence: 'Schumann Geophysics & Solfeggio Biophotonics',
    harmonics: [7.83, 264, 528, 1056],
    cymaticPatternName: 'Flor Terrestre Biológica (528 + 7.83)',
    oscillatorsConfig: [
      osc({ f: 528, name: 'ADN 528Hz', color: '#4ade80', vol: 0.4 }),
      osc({ f: 7.83, name: 'Schumann Ground', color: '#166534', vol: 0.8, y: -1, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['multimedio', 'acustica', 'electromagnetica'],
      primaryMediumLabel: 'Emisión Híbrida (Audio 528 Hz + Bobina PEMF 7.83 Hz)',
      usageMode: 'Ideal combinando reproducción acústica 528 Hz con una bobina PEMF Schumann a 7.83 Hz, o en audio/subwoofer ambiental.',
      recommendedVolume: '30% - 48%',
      recommendedVoltage: '5 V - 12 V DC (PEMF)',
      recommendedAmperage: '150 mA - 500 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '25 - 60 min',
      harmonicEquation: 'f_total = 528 Hz (Acústica) ⊕ 7.83 Hz (Campo Terrestre)',
      naturalObjectResonance: 'Agua estructurada vegetal y cavidad Tierra–Ionosfera'
    }
  },
  {
    id: 'syn_sun_moon',
    hz: '126.22-210.42',
    numericalHz: 126.22,
    name: 'Sinergia Alquimia Sol & Luna (126.22 + 210.42 Hz)',
    category: 'synergy',
    description: 'Polaridad Yang Solar (126.22 Hz) y Yin Lunar (210.42 Hz) en equilibrio espacial.',
    detailedUsage: 'Equilibra el eje simpático-parasimpático, energía activa y receptiva, proyectando el Sol en el campo izquierdo superior y la Luna sinódica en el campo derecho inferior.',
    evidence: 'Hans Cousto - Polaridades Planetarias',
    harmonics: [126.22, 210.42, 336.64],
    cymaticPatternName: 'Vesica Piscis Solar–Lunar (5:3)',
    oscillatorsConfig: [
      osc({ f: 126.22, name: 'Sol (Yang)', color: '#fcd34d', vol: 0.5, x: -0.6, y: 0.5 }),
      osc({ f: 210.42, name: 'Luna (Yin)', color: '#e2e8f0', vol: 0.5, x: 0.6, y: -0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Espacial Estéreo 3D',
      usageMode: 'Excelente como sonido de fondo equilibrante en cualquier momento del día; la razón 210.42 / 126.22 = 1.667 es prácticamente una Sexta Mayor Justa (5:3).',
      recommendedVolume: '30% - 48%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: '210.42 / 126.22 = 1.667 ≈ 5 : 3 (Sexta Mayor Justa)',
      naturalObjectResonance: 'Ritmos circadianos día/noche y glándulas suprarrenales/pineal'
    }
  },
  {
    id: 'syn_venus_mars',
    hz: '144.72-221.23',
    numericalHz: 144.72,
    name: 'Sinergia Venus & Marte (221.23 + 144.72 Hz)',
    category: 'synergy',
    description: 'Armonización de polaridad afectiva (Venus) y fuerza motriz (Marte).',
    detailedUsage: 'Integra la estética armonizadora venusiana (221.23 Hz) con el impulso dinámico marciano (144.72 Hz), formando una razón cercana a la Quinta Perfecta (1.528).',
    evidence: 'Hans Cousto - Octava Cósmica',
    harmonics: [144.72, 221.23, 365.95],
    cymaticPatternName: 'Elipse Orbital Venus–Marte',
    oscillatorsConfig: [
      osc({ f: 221.23, name: 'Venus', color: '#f472b6', vol: 0.5, x: -0.6 }),
      osc({ f: 144.72, name: 'Marte', color: '#ef4444', vol: 0.5, x: 0.6 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Estéreo Ambiental',
      usageMode: 'Sonido cálido de fondo para armonizar relaciones, motivación afectiva y creatividad.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '20 - 35 min',
      harmonicEquation: '221.23 / 144.72 = 1.5287 ≈ Quinta (3:2)',
      naturalObjectResonance: 'Corazón afectivo y eje motivacional'
    }
  },
  {
    id: 'syn_fibonacci',
    hz: '144-233',
    numericalHz: 144,
    name: 'Sinergia Acorde Fibonacci (144 + 233 Hz · Razón φ)',
    category: 'synergy',
    description: 'Dos números consecutivos de Fibonacci (F₁₂ = 144, F₁₃ = 233) en relación áurea.',
    detailedUsage: '144 Hz y 233 Hz mantienen una proporción exacta 233/144 = 1.618055 (error respecto a φ < 0.0014%). Genera un intervalo áureo libre de ciclos periódicos rígidos.',
    evidence: 'Leonardo de Pisa (Fibonacci) / Geometría Fractal',
    harmonics: [89, 144, 233, 377, 610],
    cymaticPatternName: 'Filotaxis Espiral F₁₂ : F₁₃',
    oscillatorsConfig: [
      osc({ f: 144, name: 'Fibo 144', color: '#2dd4bf', vol: 0.5, x: -0.3 }),
      osc({ f: 233, name: 'Fibo 233', color: '#14b8a6', vol: 0.5, x: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Fractal / Diseño y Meditación',
      usageMode: 'Ideal como sonido de fondo para trabajo creativo, diseño o relajación orgánica.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'F₁₃ / F₁₂ = 233 / 144 = 1.618056 ≈ φ · F₁₃ − F₁₂ = F₁₁ = 89 Hz',
      naturalObjectResonance: 'Espirales vegetales de girasol y crecimiento fractal biológico'
    }
  },
  {
    id: 'syn_pleiades',
    hz: '432-528-639',
    numericalHz: 432,
    name: 'Sinergia Armónico Pléyades (432 + 528 + 639 Hz)',
    category: 'synergy',
    description: 'Tríada luminosa ascendente para coherencia cardíaca, intuición y paz.',
    detailedUsage: 'Une la afinación cósmica 432 Hz en el centro con 528 Hz (ADN) y 639 Hz (Corazón/Relaciones) elevados en el plano espacial Y=+0.5.',
    evidence: 'Síntesis Solfeggio & Afinación 432 Hz',
    harmonics: [432, 528, 639, 1056],
    cymaticPatternName: 'Cúmulo Estelar Hexagonal Pléyades',
    oscillatorsConfig: [
      osc({ f: 432, name: 'Pléyades Base', color: '#0ea5e9', vol: 0.4 }),
      osc({ f: 528, name: 'Pléyades High', color: '#38bdf8', vol: 0.3, x: -0.5, y: 0.5 }),
      osc({ f: 639, name: 'Pléyades Connect', color: '#7dd3fc', vol: 0.3, x: 0.5, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental Envolvente',
      usageMode: 'Sonido de fondo muy armonioso para meditación guiada, descanso y espacios terapéuticos.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Tríada {432, 528, 639} Hz (Pasos +96 Hz y +111 Hz)',
      naturalObjectResonance: 'Campo cardíaco y resonancia armónica en agua'
    }
  },
  {
    id: 'syn_sirius',
    hz: '396-741',
    numericalHz: 396,
    name: 'Sinergia Conexión Sirio (396 + 741 Hz)',
    category: 'synergy',
    description: 'Polaridad de liberación raíz (396 Hz) y claridad expresiva/desintoxicación (741 Hz).',
    detailedUsage: 'Conecta la base 396 Hz con el limpiador espectral 741 Hz creando un intervalo cercano a la séptima armónica pura, despejando densidad emocional y mental.',
    evidence: 'Solfeggio Polarity Synthesis',
    harmonics: [396, 741, 1137],
    cymaticPatternName: 'Estrella Binaria Sirio A–B',
    oscillatorsConfig: [
      osc({ f: 396, name: 'Sirio Base', color: '#6366f1', vol: 0.5, x: -0.4 }),
      osc({ f: 741, name: 'Sirio Light', color: '#818cf8', vol: 0.4, x: 0.4, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Clara / Limpieza de Espacio',
      usageMode: 'Ideal en sesiones breves de 15–25 min para renovar claridad cognitiva y ambiental.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '15 - 30 min',
      harmonicEquation: '741 / 396 = 1.8712 ≈ 15:8 (Séptima Mayor Justa 1.875)',
      naturalObjectResonance: 'Sistema nervioso autónomo y glándula tiroides'
    }
  },
  {
    id: 'syn_orion',
    hz: '144-528-852',
    numericalHz: 528,
    name: 'Sinergia Tríada Cinturón de Orión (Alnitak · Alnilam · Mintaka)',
    category: 'synergy',
    description: 'Alineación triple 144 Hz (Luz) + 528 Hz (ADN) + 852 Hz (Intuición).',
    detailedUsage: 'Estructura piramidal sonora de 3 nodos: Alnitak en 144 Hz (izquierda), Alnilam en 528 Hz (cúspide central) y Mintaka en 852 Hz (derecha).',
    evidence: 'Geometría Sagrada / Tríada Solfeggio-Fibonacci',
    harmonics: [144, 528, 852, 1056],
    cymaticPatternName: 'Triángulo Isósceles de Tres Estrellas',
    oscillatorsConfig: [
      osc({ f: 144, name: 'Alnitak (144 Hz)', color: '#3b82f6', vol: 0.4, x: -0.5 }),
      osc({ f: 528, name: 'Alnilam (528 Hz)', color: '#60a5fa', vol: 0.4, y: 0.5 }),
      osc({ f: 852, name: 'Mintaka (852 Hz)', color: '#93c5fd', vol: 0.4, x: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Espacial 3D / Meditación Geometría Sagrada',
      usageMode: 'Reproducir en altavoces estéreo o auriculares para visualizar la tríada ascendente en el espacio sonoro.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: 'Triada 3-6-9: 144(9) + 528(6) + 852(6)',
      naturalObjectResonance: 'Eje columna–corazón–pineal'
    }
  },
  {
    id: 'syn_arcturus',
    hz: '396-528-963',
    numericalHz: 528,
    name: 'Sinergia Matriz Sanación Arcturus (396 + 528 + 963 Hz)',
    category: 'synergy',
    description: 'Stack completo liberación (396) + reparación estructural (528) + unidad (963).',
    detailedUsage: 'Configuración triangular envolvente que libera tensión basal (396), repara el campo celular (528) y abre el vértice superior coronal (963).',
    evidence: 'Integración Solfeggio Tri-Planar',
    harmonics: [396, 528, 963],
    cymaticPatternName: 'Pirámide Tri-Planar de Luz',
    oscillatorsConfig: [
      osc({ f: 396, name: 'Release Fear (396 Hz)', color: '#f87171', vol: 0.4, x: -0.3, y: -0.2 }),
      osc({ f: 528, name: 'Heal Structure (528 Hz)', color: '#4ade80', vol: 0.4, x: 0.3, y: -0.2 }),
      osc({ f: 963, name: 'Spirit Unity (963 Hz)', color: '#facc15', vol: 0.3, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Terapéutica Ambiental',
      usageMode: 'Excelente como fondo en sesiones de sanación energética, reiki o meditación restaurativa.',
      recommendedVolume: '24% - 42%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: '396 + 528 + 963 = 1887 Hz · Raíces {9, 6, 9}',
      naturalObjectResonance: 'Campo bioenergético integral y sistema neuroinmune'
    }
  },
  {
    id: 'syn_christ',
    hz: '33-33.8-132',
    numericalHz: 33,
    name: 'Sinergia Resonancia Crística 33 Hz & 5º Modo Schumann',
    category: 'synergy',
    description: 'Pulso maestro 33 Hz acoplado al 5º armónico Schumann (33.8 Hz) y su doble octava.',
    detailedUsage: 'Conecta la vibración estructural vertebral 33 Hz con el 5º armónico terrestre Schumann (33.8 Hz, creando un pulso lento de 0.8 Hz) y su cuarta armónica audible 132 Hz para percepción en cualquier altavoz.',
    evidence: 'Tradición Pitagórica 33 / Espectro Schumann Modo V (33.8 Hz)',
    binauralBeatHz: 0.8,
    harmonics: [33, 33.8, 66, 132, 333],
    cymaticPatternName: 'Estrella Coral 33-33.8 (Δ=0.8 Hz)',
    oscillatorsConfig: [
      osc({ f: 33, name: 'Resonancia 33 Hz', color: '#fb923c', vol: 0.7, ind: true }),
      osc({ f: 33.8, name: 'Schumann Modo V (33.8 Hz)', color: '#f59e0b', vol: 0.45, ind: true }),
      osc({ f: 132, name: 'Octava Audible 4×33 (132 Hz)', color: '#fcd34d', vol: 0.32 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica', 'electromagnetica'],
      primaryMediumLabel: 'Vibroacústica Espinal + Bobina PEMF 33 Hz',
      usageMode: 'Ideal en transductor corporal dorsal, subwoofer o bobina PEMF; el armónico 132 Hz permite escucharlo nítidamente incluso en altavoces pequeños.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 35 min',
      numerologyRelation: '33 vértebras · 33.8 Hz − 33 Hz = 0.8 Hz (Pulso Epsilon profundo)',
      harmonicEquation: 'f₀ = 33 Hz · f_S5 = 33.8 Hz · 4f₀ = 132 Hz',
      naturalObjectResonance: 'Columna vertebral (33 vértebras) y 5º modo ionosférico Schumann'
    }
  },
  {
    id: 'syn_fifth',
    hz: '256-384',
    numericalHz: 256,
    name: 'Sinergia Quinta Perfecta (3:2 · Do 256 + Sol 384 Hz)',
    category: 'synergy',
    description: 'El intervalo más consonante tras la octava: apertura torácica y equilibrio.',
    detailedUsage: 'Proporción exacta 3:2 en afinación científica (256 Hz izquierda, 384 Hz derecha). Produce figuras de Lissajous perfectamente cerradas de entropía mínima.',
    evidence: 'Acústica Pitagórica / Acutonics Fifth Interval',
    harmonics: [128, 256, 384, 512, 768],
    cymaticPatternName: 'Lissajous 3:2 Cerrado (Quinta Justa)',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Raíz (C)', color: '#94a3b8', vol: 0.5, x: -0.4 }),
      osc({ f: 384, name: 'Quinta (G)', color: '#64748b', vol: 0.5, x: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Pura / Diapasones C & G',
      usageMode: 'Sonido de fondo extraordinariamente estable y relajante para estudio, descanso o equilibrio nervioso.',
      recommendedVolume: '28% - 48%',
      recommendedDuration: '20 - 60 min',
      harmonicEquation: 'f₂ / f₁ = 384 / 256 = 3 / 2 (701.96 cents)',
      naturalObjectResonance: 'Sistema nervioso simpático/parasimpático y cavidad torácica'
    }
  },
  {
    id: 'syn_tritone',
    hz: '256-362.04',
    numericalHz: 256,
    name: 'Sinergia Tritono √2 (Diabolus in Musica · 256 + 362.04 Hz)',
    category: 'synergy',
    description: 'Razón irracional √2:1 (256 Hz + 362.04 Hz) para ruptura de estancamiento.',
    detailedUsage: 'Divide exactamente la octava por la mitad geométrica (√2 ≈ 1.4142135). Históricamente evitado en liturgias por su tensión dinámica, hoy se utiliza brevemente para desbloquear estancamientos emocionales y estimular plasticidad cortical.',
    evidence: 'Teoría Intervalar / Geometría Diagonal √2',
    harmonics: [256, 362.04, 512],
    cymaticPatternName: 'Diagonal del Cuadrado (√2)',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Raíz (C)', color: '#ef4444', vol: 0.5, x: -0.4 }),
      osc({ f: 362.04, name: 'Tritono (F#)', color: '#dc2626', vol: 0.5, x: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Activa Breve / Desbloqueo',
      usageMode: 'Usar en sesiones cortas (5–15 min) y resolver después pasando a "Sinergia Quinta Perfecta (3:2)" para experimentar la liberación armónica.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '5 - 15 min',
      harmonicEquation: 'f₂ / f₁ = 362.04 / 256 = √2 ≈ 1.414214 (600 cents)',
      naturalObjectResonance: 'Diagonal del cuadrado sagrado y respuesta de alerta cortical'
    }
  },
  {
    id: 'syn_tesla_369',
    hz: '369-639-963',
    numericalHz: 369,
    name: 'Sinergia Vórtex 3-6-9 de Nikola Tesla',
    category: 'synergy',
    description: 'Triada sagrada de Tesla para manifestación y energía libre de la mente.',
    detailedUsage: 'Stack de 3 osciladores en 369 Hz, 639 Hz y 963 Hz dispuestos espacialmente. Genera interferencia constructiva en las tres permutaciones mayores de la escala 3-6-9.',
    evidence: 'Matemática Vórtex / Nikola Tesla',
    harmonics: [369, 639, 963, 1971],
    cymaticPatternName: 'Toroide Trilateral 3-6-9',
    oscillatorsConfig: [
      osc({ f: 369, name: 'Vórtex 369Hz', color: '#22d3ee', vol: 0.4, x: -0.5 }),
      osc({ f: 639, name: 'Armonización 639Hz', color: '#a855f7', vol: 0.4, y: 0.5 }),
      osc({ f: 963, name: 'Conciencia 963Hz', color: '#f472b6', vol: 0.4, x: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'magnetica'],
      primaryMediumLabel: 'Acústica Estéreo 3D / Bobina Toroidal 3-6-9',
      usageMode: 'Sonido envolvente brillante para foco creativo, intención meditativa o alimentación de bobinas toroidales.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '15 - 35 min',
      numerologyRelation: '369 + 639 + 963 = 1971 → 1+9+7+1 = 18 → 9',
      harmonicEquation: 'Permutaciones cíclicas Σ(3,6,9) ∈ {369, 639, 963} Hz',
      naturalObjectResonance: 'Flujos toroidales electromagnéticos y agua estructurada'
    }
  },
  {
    id: 'syn_heart_coherence',
    hz: '341.3-528-10',
    numericalHz: 528,
    name: 'Sinergia Coherencia Cardíaca y Relaciones (HeartMath)',
    category: 'synergy',
    description: 'Chakra Corazón 341.33 Hz + 528 Hz ADN + Pulso Alfa 10 Hz.',
    detailedUsage: 'Integra la cuarta perfecta del corazón (341.33 Hz) con la reparación celular de 528 Hz y la modulación de estado Alfa de 10 Hz.',
    evidence: 'HeartMath Institute & Solfeggio',
    harmonics: [10, 341.33, 528, 682.66],
    cymaticPatternName: 'Rosa Cardíaca Coherente (10 Hz)',
    oscillatorsConfig: [
      osc({ f: 341.33, name: 'Fa Corazón', color: '#4ade80', vol: 0.4, x: -0.4 }),
      osc({ f: 528, name: 'Mi ADN', color: '#22c55e', vol: 0.4, x: 0.4 }),
      osc({ f: 10, name: 'Alfa Pulse', color: '#fbbf24', vol: 0.7, y: -0.8, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental / Respiración Cardíaca',
      usageMode: 'Ideal como sonido de fondo terapéutico mientras se practica respiración lenta y gratitud emocional.',
      recommendedVolume: '28% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: '341.33 Hz (Fa4) ⊕ 528 Hz (Do5) ⊕ 10 Hz (Alfa)',
      naturalObjectResonance: 'Campo toroidal del corazón y ondas alfa cerebrales'
    }
  },
  {
    id: 'syn_merkaba',
    hz: '111-432-963',
    numericalHz: 432,
    name: 'Sinergia Activación de Campo Toroidal Merkaba',
    category: 'synergy',
    description: '111 Hz Oráculo Malta + 432 Hz Giza + 963 Hz Corona.',
    detailedUsage: 'Conecta la cavidad megalítica de Malta (111 Hz) con la geometría de Giza (432 Hz) y el vórtex pineal coronal (963 Hz) en un campo espacial tridimensional.',
    evidence: 'Arqueoacústica y Geometría Sagrada',
    harmonics: [111, 432, 963],
    cymaticPatternName: 'Estrella Tetraédrica Merkaba 3D',
    oscillatorsConfig: [
      osc({ f: 111, name: 'Malta 111Hz', color: '#38bdf8', vol: 0.5, x: -0.6, y: -0.3 }),
      osc({ f: 432, name: 'Giza 432Hz', color: '#c084fc', vol: 0.4 }),
      osc({ f: 963, name: 'Crown 963Hz', color: '#f472b6', vol: 0.4, x: 0.6, y: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Espacial 3D / Meditación Profunda',
      usageMode: 'Usar en postura sentada con auriculares o sistema estéreo de sala en silencio meditativo.',
      recommendedVolume: '25% - 42%',
      recommendedDuration: '20 - 40 min',
      harmonicEquation: '111 Hz (9) → 432 Hz (9) → 963 Hz (9)',
      naturalObjectResonance: 'Eje craneosacral y campo toroidal humano'
    }
  },
  {
    id: 'syn_deep_sleep',
    hz: '0.5-2.0-174',
    numericalHz: 174,
    name: 'Sinergia Sueño Profundo & Anestesia Regenerativa',
    category: 'synergy',
    description: 'Onda Epsilon 0.5 Hz + Delta 2.0 Hz + Solfeggio 174 Hz.',
    detailedUsage: 'Induce relajación muscular profunda con alivio nociceptivo (174 Hz) acoplado a los pulsos regenerativos Delta (2 Hz) y Epsilon (0.5 Hz).',
    evidence: 'Neuroacústica del Sueño & Solfeggio',
    harmonics: [0.5, 2, 174, 348],
    cymaticPatternName: 'Nube Nodal Sedante 174 Hz',
    oscillatorsConfig: [
      osc({ f: 0.5, name: 'Epsilon 0.5Hz', color: '#818cf8', vol: 0.6, ind: true }),
      osc({ f: 2.0, name: 'Delta 2Hz', color: '#6366f1', vol: 0.6, x: -0.5, ind: true }),
      osc({ f: 174, name: 'Anestésico 174Hz', color: '#a78bfa', vol: 0.4, x: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Acústica Nocturna Tenue / PEMF Bajo Almohada',
      usageMode: 'Reproducir a volumen bajo al acostarse para facilitar el sueño profundo y alivio de tensión física.',
      recommendedVolume: '20% - 36%',
      recommendedDuration: '30 - 90 min',
      harmonicEquation: '174 Hz ⊕ 2.0 Hz (Delta) ⊕ 0.5 Hz (Epsilon)',
      naturalObjectResonance: 'Sistema nervioso parasimpático y fascia muscular'
    }
  },
  // --- 10 NUEVAS SINERGIAS INVESTIGADAS MULTI-OSCILADOR ---
  {
    id: 'syn_vagal_ez_water',
    hz: '0.1-25-528-1009.85',
    numericalHz: 528,
    name: 'Sinergia Coherencia Vagal & Agua Celular EZ',
    category: 'synergy',
    description: 'HRV 0.1 Hz + Nervio Vago 25 Hz + ADN 528 Hz + Agua EZ (270 nm ÷ 2⁴⁰).',
    detailedUsage: 'Integra la coherencia autonómica HeartMath (0.1 Hz) y estimulación vagal antiinflamatoria (25 Hz) con 528 Hz y la firma espectroscópica del agua estructurada H₃O₂⁻ (1009.85 Hz / 727.09 Hz IR), optimizando hidratación intracelular y tono parasimpático.',
    evidence: 'HeartMath / Gerald Pollack EZ Water / Neuroinmunología Vagal',
    harmonics: [0.1, 25, 528, 727.09, 1009.85],
    cymaticPatternName: 'Retícula Hexagonal H₃O₂⁻ Vagal',
    oscillatorsConfig: [
      osc({ f: 528, name: 'Coherencia Hídrica 528 Hz', color: '#4ade80', vol: 0.38 }),
      osc({ f: 1009.85, name: 'Firma Agua EZ 270nm ÷ 2⁴⁰', color: '#38bdf8', vol: 0.2, x: -0.45 }),
      osc({ f: 727.09, name: 'Expansión IR 3000nm ÷ 2³⁷', color: '#fb7185', vol: 0.25, x: 0.45 }),
      osc({ f: 25, name: 'Tono Vagal 25 Hz', type: 'triangle', color: '#2dd4bf', vol: 0.45, ind: true }),
      osc({ f: 0.1, name: 'Respiración HRV 0.1 Hz', color: '#f87171', vol: 0.5, ind: true })
    ],
    technicalRecommendation: {
      recommendedMediums: ['multimedio', 'acustica', 'fotonica_nir'],
      primaryMediumLabel: 'Emisión Híbrida (Audio + Luz Cálida IR + Respiración 0.1 Hz)',
      usageMode: 'Excelente acompañando hidratación con agua pura y respiración lenta 5s/5s; la luz infrarroja cercana expande la capa EZ mientras 25 Hz y 528 Hz calman el eje vagal.',
      recommendedVolume: '24% - 40%',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '200 mA - 700 mA',
      recommendedWatts: '3 W - 12 W',
      recommendedDuration: '20 - 35 min',
      harmonicEquation: 'f = {0.1, 25, 528, 727.09, 1009.85} Hz',
      naturalObjectResonance: 'Agua intracelular H₃O₂⁻, nervio vago y barorreceptores'
    }
  },
  {
    id: 'syn_piezo_crystal',
    hz: '256-512-4096-16384',
    numericalHz: 4096,
    name: 'Sinergia Cristalización Piezoeléctrica Cuarzo–Turmalina',
    category: 'synergy',
    description: 'Cascada binaria cristalina 2⁸ (256 Hz) · 2⁹ (512 Hz) · 2¹² (4096 Hz) · 2¹⁴ (16.384 kHz).',
    detailedUsage: 'Diseñada sobre potencias puras de 2 que culminan en el oscilador de cuarzo 32,768 Hz (2¹⁵) y el eje FIR de turmalina (512 Hz), generando interferencia cristalina limpia para clarificar ambientes o energizar cuarzos físicos.',
    evidence: 'Física Piezoeléctrica SiO₂ / Silicatos Piroeléctricos',
    harmonics: [256, 512, 1024, 4096, 16384, 32768],
    cymaticPatternName: 'Red Trigonal SiO₂ de Alta Simetría',
    oscillatorsConfig: [
      osc({ f: 256, name: 'Base Cuarzo 2⁸ (256 Hz)', color: '#34d399', vol: 0.42, y: -0.4 }),
      osc({ f: 512, name: 'Turmalina 2⁹ (512 Hz)', type: 'triangle', color: '#2dd4bf', vol: 0.35 }),
      osc({ f: 4096, name: 'Angel Cuarzo 2¹² (4096 Hz)', color: '#a7f3d0', vol: 0.16, x: -0.45, y: 0.4 }),
      osc({ f: 16384, name: 'Sub-Cuarzo 2¹⁴ (16.384 kHz)', color: '#6ee7b7', vol: 0.1, x: 0.45, y: 0.4 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'ionica_plasma', 'fotonica_nir'],
      primaryMediumLabel: 'Acústica Suave / Transductor Piezoeléctrico + Iones Negativos',
      usageMode: 'Usar a volumen suave (≤ 30%) debido a la presencia de 4096 Hz y 16.384 kHz; ideal cerca de drusas de cuarzo o turmalina.',
      recommendedVolume: '15% - 30%',
      recommendedVoltage: '3.3 V - 12 V DC',
      recommendedAmperage: '100 mA - 400 mA',
      recommendedWatts: '1 W - 5 W',
      recommendedDuration: '10 - 20 min',
      harmonicEquation: 'f_n = 2ⁿ Hz para n ∈ {8, 9, 12, 14} → 32,768 = 2¹⁵ Hz',
      naturalObjectResonance: 'Redes cristalinas de α-cuarzo y turmalina negra'
    }
  },
  {
    id: 'syn_schumann_shield',
    hz: '7.83-11.78-14.3-20.8-741',
    numericalHz: 7.83,
    name: 'Sinergia Escudo Electromagnético Schumann–Solfeggio',
    category: 'synergy',
    description: 'Modos Schumann I–III (7.83, 14.3, 20.8 Hz) + Tesla 11.78 Hz + Limpiador 741 Hz.',
    detailedUsage: 'Restaura la envolvente geomagnética natural frente a la fatiga electromagnética artificial de 50/60 Hz y RF urbana, combinando la escalera Schumann completa y el limpiador espectral 741 Hz.',
    evidence: 'Geofísica Schumann / Tesla / Bio-Higiene Electromagnética',
    harmonics: [7.83, 11.78, 14.3, 20.8, 741],
    cymaticPatternName: 'Escudo Toroidal Ionosférico',
    oscillatorsConfig: [
      osc({ f: 7.83, name: 'Schumann I (7.83 Hz)', color: '#22d3ee', vol: 0.7, ind: true }),
      osc({ f: 14.3, name: 'Schumann II (14.3 Hz)', color: '#38bdf8', vol: 0.45, ind: true }),
      osc({ f: 20.8, name: 'Schumann III (20.8 Hz)', color: '#0ea5e9', vol: 0.35, ind: true }),
      osc({ f: 11.78, name: 'Tesla Terrestre (11.78 Hz)', color: '#818cf8', vol: 0.45, ind: true }),
      osc({ f: 741, name: 'Limpiador 741 Hz', color: '#c084fc', vol: 0.28 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['electromagnetica', 'magnetica', 'multimedio'],
      primaryMediumLabel: 'Bobina PEMF / Generador Schumann de Escritorio + Audio Tenue',
      usageMode: 'Máxima efectividad al emitirse mediante bobina PEMF ambiental en oficinas o dormitorios con alta carga de Wi-Fi/pantallas; en audio el 741 Hz actúa como portador audible.',
      recommendedVolume: '18% - 35% (Audio) | PEMF continuo suave',
      recommendedVoltage: '5 V - 12 V DC',
      recommendedAmperage: '150 mA - 600 mA',
      recommendedWatts: '2 W - 8 W',
      recommendedDuration: '30 - 90 min',
      harmonicEquation: 'Schumann {7.83, 14.3, 20.8} ⊕ Tesla 11.78 ⊕ Solfeggio 741 Hz',
      naturalObjectResonance: 'Cavidad ionosférica y potencial bioeléctrico de membrana'
    }
  },
  {
    id: 'syn_platonic_golden',
    hz: '137.036-144-233-377-432',
    numericalHz: 144,
    name: 'Sinergia Sinfonía Áurea Fibonacci–Platónica',
    category: 'synergy',
    description: 'Fibonacci (144, 233, 377 Hz) + Estructura Fina α⁻¹ (137.036 Hz) + Giza 432 Hz.',
    detailedUsage: 'Unifica tres escalas consecutivas de Fibonacci (F₁₂=144, F₁₃=233, F₁₄=377 Hz) con la constante electromagnética cuántica α⁻¹=137.036 Hz y la afinación pitagórica 432 Hz en una sinfonía fractal inagotable.',
    evidence: 'QED α⁻¹ / Sucesión de Fibonacci / Afinación 432 Hz',
    harmonics: [137.036, 144, 233, 377, 432],
    cymaticPatternName: 'Dodecaedro Áureo de Fibonacci',
    oscillatorsConfig: [
      osc({ f: 137.036, name: 'Estructura Fina α⁻¹', color: '#fcd34d', vol: 0.35, x: -0.6 }),
      osc({ f: 144, name: 'Fibonacci F₁₂ (144 Hz)', color: '#2dd4bf', vol: 0.38, x: -0.25 }),
      osc({ f: 233, name: 'Fibonacci F₁₃ (233 Hz)', color: '#14b8a6', vol: 0.35, x: 0.25 }),
      osc({ f: 377, name: 'Fibonacci F₁₄ (377 Hz)', color: '#38bdf8', vol: 0.28, x: 0.6 }),
      osc({ f: 432, name: 'Ancla 432 Hz (3×144)', color: '#c084fc', vol: 0.32, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Polifónica Estéreo (5 Capas Áureas)',
      usageMode: 'Ideal como paisaje sonoro de fondo de alta coherencia matemática para creatividad, arquitectura, matemáticas y meditación profunda.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '25 - 60 min',
      numerologyRelation: '144 + 233 = 377 · 377 / 233 = 1.618026 ≈ φ · 432 = 3 × 144',
      harmonicEquation: 'Fₙ₊₁ = Fₙ + Fₙ₋₁ ∈ {144, 233, 377} ⊕ α⁻¹(137.036) ⊕ 432 Hz',
      naturalObjectResonance: 'Filotaxis espiral, cuasicristales icosaédricos y dodecaedros'
    }
  },
  {
    id: 'syn_mitochondrial_pbm',
    hz: '15-24-40-128-292',
    numericalHz: 40,
    name: 'Sinergia Regeneración Mitocondrial Fotónica–PEMF',
    category: 'synergy',
    description: '15 Hz Bassett + 24 Hz Ciclotrón Ca²⁺ + 40 Hz ATP/Gamma + 128 Hz NO + 292 Hz Nogier A.',
    detailedUsage: 'Protocolo biofísico integral de recuperación tisular: une osteogénesis PEMF (15 Hz), apertura de canales de calcio (24 Hz), pulsación mitocondrial de citocromo c oxidasa (40 Hz), liberación vascular de óxido nítrico (128 Hz) y epitelización ectodérmica Nogier A (292 Hz).',
    evidence: 'Bassett PEMF / Liboff ICR / Hamblin PBM / Nogier / Beaulieu',
    harmonics: [15, 24, 40, 128, 292],
    cymaticPatternName: 'Cresta Bioenergética Multi-Escala',
    oscillatorsConfig: [
      osc({ f: 15, name: 'Bassett Osteogénesis 15 Hz', type: 'square', color: '#f87171', vol: 0.45, ind: true, duty: 0.3 }),
      osc({ f: 24, name: 'Liboff Ca²⁺ ICR 24 Hz', color: '#38bdf8', vol: 0.45, ind: true }),
      osc({ f: 40, name: 'Pulso CCO ATP 40 Hz', type: 'square', color: '#facc15', vol: 0.45, ind: true, duty: 0.2 }),
      osc({ f: 128, name: 'Óxido Nítrico Otto 128 Hz', color: '#fb7185', vol: 0.4, x: -0.35 }),
      osc({ f: 292, name: 'Nogier A Ectodermo 292 Hz', color: '#fb923c', vol: 0.35, x: 0.35 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['multimedio', 'fotonica_nir', 'electromagnetica'],
      primaryMediumLabel: 'Sinergia Multi-Medio: Panel LED 660/810 nm + Bobina PEMF + Transductor',
      usageMode: 'Su máximo potencial ocurre en aplicación híbrida: fotobiomodulación 660/810 nm modulada a 40 Hz / 292 Hz junto a bobina PEMF de 15–24 Hz y audio/transductor 128 Hz.',
      recommendedVolume: '25% - 42%',
      recommendedVoltage: '12 V - 24 V DC',
      recommendedAmperage: '400 mA - 2.0 A',
      recommendedWatts: '8 W - 35 W',
      recommendedDuration: '15 - 25 min',
      harmonicEquation: 'ATP + NO + Ca²⁺ = PBM(660/810nm @ 40/292Hz) ⊕ PEMF(15/24Hz) ⊕ 128Hz',
      naturalObjectResonance: 'Mitocondrias, osteoblastos, endotelio y matriz colagénica'
    }
  },
  {
    id: 'syn_archaeo_trance',
    hz: '34.4-68.8-110-111-432',
    numericalHz: 110,
    name: 'Sinergia Cámara Arqueoacústica Ancestral (5 Megalitos)',
    category: 'synergy',
    description: 'Barabar 34.4 Hz + Göbekli Tepe 68.8 Hz + Newgrange 110 Hz + Malta 111 Hz + Giza 432 Hz.',
    detailedUsage: 'Sintetiza la acústica de los cinco grandes santuarios líticos de la humanidad en un solo acorde telúrico: la progresión 34.4 → 68.8 Hz (Barabar–Göbekli), el par binaural/batido 110–111 Hz (Newgrange–Malta, Δ=1 Hz) y la bóveda resonante de Giza (432 Hz).',
    evidence: 'Arqueoacústica Comparada (ALBA / SB Research / PEAR / Devereux)',
    location: 'Barabar · Göbekli Tepe · Newgrange · Malta · Giza',
    binauralBeatHz: 1.0,
    harmonics: [34.4, 68.8, 110, 111, 432],
    cymaticPatternName: 'Cámara Lítica Megalítica de 5 Nodos',
    oscillatorsConfig: [
      osc({ f: 34.4, name: 'Cuevas Barabar (34.4 Hz)', color: '#f59e0b', vol: 0.45, y: -0.5 }),
      osc({ f: 68.8, name: 'Göbekli Tepe (68.8 Hz)', color: '#d97706', vol: 0.35 }),
      osc({ f: 110, name: 'Newgrange (110 Hz)', color: '#fbbf24', vol: 0.42, x: -0.5 }),
      osc({ f: 111, name: 'Hipogeo Malta (111 Hz)', color: '#fcd34d', vol: 0.42, x: 0.5 }),
      osc({ f: 432, name: 'Gran Pirámide Giza (432 Hz)', color: '#c084fc', vol: 0.28, y: 0.5 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Envolvente Estéreo / Auriculares de Rango Completo',
      usageMode: 'El cruce 110 Hz (Newgrange) vs 111 Hz (Malta) genera un latido de 1 Hz extraordinariamente inmersivo para meditación profunda y estados contemplativos.',
      recommendedVolume: '30% - 50%',
      recommendedDuration: '20 - 45 min',
      numerologyRelation: 'Δ(111 − 110) = 1.0 Hz · 68.8 = 2 × 34.4 Hz',
      harmonicEquation: 'Σ_Megalitos = {34.4, 68.8, 110, 111, 432} Hz',
      naturalObjectResonance: 'Granito, caliza coralina y cámaras resonantes megalíticas'
    }
  },
  {
    id: 'syn_mycelial_forest',
    hz: '136.1-250-400-432-4000',
    numericalHz: 400,
    name: 'Sinergia Red Ecológica Micelio–Clorofila–Colmena',
    category: 'synergy',
    description: 'OM Tierra 136.1 Hz + Colmena 250 Hz + Micelio 400 Hz + Clorofila/Armonía 432 Hz + Alba 4 kHz.',
    detailedUsage: 'Recrea el ecosistema vibracional completo de un bosque sano: suelo micelial conductor (400 Hz), panal polinizador (250 Hz), año terrestre (136.1 Hz) y un sutil armónico de coro matutino (4,000 Hz) para vitalidad vegetal y calma biofílica.',
    evidence: 'Bioacústica Forestal / Adamatzky / Dan Carlson / Apiterapia',
    location: 'Ecosistema Forestal Simbiótico',
    harmonics: [136.1, 250, 400, 432, 4000],
    cymaticPatternName: 'Simbiosis Rizosfera–Copa–Colmena',
    oscillatorsConfig: [
      osc({ f: 136.1, name: 'Suelo Tierra OM (136.1 Hz)', color: '#059669', vol: 0.42, y: -0.6 }),
      osc({ f: 250, name: 'Colmena Apis (250 Hz)', type: 'triangle', color: '#facc15', vol: 0.3, x: -0.5 }),
      osc({ f: 400, name: 'Conducción Micelial (400 Hz)', color: '#34d399', vol: 0.32, x: 0.5 }),
      osc({ f: 432, name: 'Armonía Botánica (432 Hz)', color: '#4ade80', vol: 0.28 }),
      osc({ f: 4000, name: 'Alba Estomática (4.0 kHz)', color: '#a7f3d0', vol: 0.1, y: 0.7 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Ambiental Biofílica (Hogar / Invernaderos)',
      usageMode: 'Agradable tanto para relajación biofílica humana como para ambientación de plantas de interior e invernaderos.',
      recommendedVolume: '22% - 40%',
      recommendedDuration: '20 - 60 min',
      harmonicEquation: 'Bosque = 136.1(OM) ⊕ 250(Panal) ⊕ 400(Micelio) ⊕ 432 ⊕ 4000(Estomas)',
      naturalObjectResonance: 'Rizosfera micelial, colmenas y estomas foliares'
    }
  },
  {
    id: 'syn_feline_osteo',
    hz: '15-26-50-128',
    numericalHz: 26,
    name: 'Sinergia Bio-Matriz Osteofónica Felina & Óxido Nítrico',
    category: 'synergy',
    description: '15 Hz Bassett PEMF + 26 & 50 Hz Ronroneo Felino + 128 Hz Otto Óxido Nítrico.',
    detailedUsage: 'Sinergia biomecánica especializada en tejido osteoarticular, ligamentos y circulación local: fusiona el espectro anabólico del ronroneo felino (26 y 50 Hz) con osteogénesis PEMF (15 Hz) y liberación endotelial de NO (128 Hz).',
    evidence: 'Bioacústica Felina / Bassett PEMF / Beaulieu 128 Hz',
    harmonics: [15, 26, 50, 100, 128],
    cymaticPatternName: 'Trabécula Ósea Anabólica',
    oscillatorsConfig: [
      osc({ f: 26, name: 'Ronroneo Anabólico 26 Hz', type: 'triangle', color: '#34d399', vol: 0.55, cv: 1.3 }),
      osc({ f: 50, name: 'Consolidación 50 Hz', color: '#10b981', vol: 0.45 }),
      osc({ f: 128, name: 'Otto Óxido Nítrico 128 Hz', color: '#f87171', vol: 0.42 }),
      osc({ f: 15, name: 'Bassett PEMF 15 Hz', type: 'square', color: '#fb923c', vol: 0.45, ind: true, duty: 0.3 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'electromagnetica'],
      primaryMediumLabel: 'Transductor Vibroacústico Corporal + Bobina PEMF',
      usageMode: 'Ideal aplicando transductor táctil o subwoofer cercano a articulaciones/espalda y, si se dispone, bobina PEMF a 15 Hz.',
      recommendedVolume: '35% - 55%',
      recommendedVoltage: '5 V - 15 V DC',
      recommendedAmperage: '250 mA - 900 mA',
      recommendedWatts: '3 W - 15 W',
      recommendedDuration: '20 - 35 min',
      harmonicEquation: 'Osteogénesis = 15 Hz (PEMF) ⊕ 26/50 Hz (Mecánica) ⊕ 128 Hz (NO)',
      naturalObjectResonance: 'Trabéculas óseas, cartílago y endotelio vascular'
    }
  },
  {
    id: 'syn_quantum_hydrogen',
    hz: '137.036-161.803-271.828-338.65',
    numericalHz: 338.65,
    name: 'Sinergia Hidrógeno Cósmico & Constantes Universales',
    category: 'synergy',
    description: 'Línea HI 1420.4 MHz (÷2²² = 338.65 Hz) + α⁻¹ (137.036) + φ (161.803) + e (271.828).',
    detailedUsage: 'Acorde físico-matemático universal que reúne la transición hiperfina del hidrógeno cósmico (338.65 Hz), la constante de estructura fina (137.036 Hz), la proporción áurea (161.803 Hz) y el número de Euler (271.828 Hz).',
    evidence: 'Radioastronomía HI / QED / Constantes Fundamentales',
    harmonics: [137.036, 161.803, 271.828, 338.65, 677.3],
    cymaticPatternName: 'Constelación Cuántica Universal (α, φ, e, H)',
    oscillatorsConfig: [
      osc({ f: 137.036, name: 'Estructura Fina α⁻¹ (137.04 Hz)', color: '#fcd34d', vol: 0.36, x: -0.6 }),
      osc({ f: 161.803, name: 'Proporción Áurea φ (161.80 Hz)', color: '#fbbf24', vol: 0.34, x: -0.2 }),
      osc({ f: 271.828, name: 'Número de Euler e (271.83 Hz)', color: '#38bdf8', vol: 0.34, x: 0.2 }),
      osc({ f: 338.65, name: 'Hidrógeno 21cm ÷ 2²² (338.65 Hz)', color: '#22d3ee', vol: 0.38, x: 0.6 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica', 'multimedio'],
      primaryMediumLabel: 'Acústica Espacial 3D / Contemplación Científica',
      usageMode: 'Escucha contemplativa en auriculares o altavoces de estudio para inmersión en las proporciones fundamentales del cosmos.',
      recommendedVolume: '25% - 45%',
      recommendedDuration: '20 - 45 min',
      harmonicEquation: 'Ψ_Cosmos = α⁻¹(137.036) ⊕ 100φ(161.803) ⊕ 100e(271.828) ⊕ f_HI/2²²(338.65)',
      naturalObjectResonance: 'Átomo de hidrógeno primordial y vacíos cuánticos'
    }
  },
  {
    id: 'syn_tibetan_bell_halo',
    hz: '108-216-217.2-259.2-324-432',
    numericalHz: 216,
    name: 'Sinergia Halo Acústico de Campana & Cuenco Tibetano',
    category: 'synergy',
    description: 'Serie campanológica completa (108·216·259.2·324·432 Hz) con doblete batido 1.2 Hz.',
    detailedUsage: 'Sintetiza la riqueza armónica completa de una campana sagrada de bronce junto al doblete asimétrico típico de un cuenco himalayo martillado (216 Hz vs 217.2 Hz, batido 1.2 Hz), creando un aura sonora multidimensional.',
    evidence: 'Campanología Europea & Acústica de Cuencos Tibetanos',
    harmonics: [108, 216, 217.2, 259.2, 324, 432],
    cymaticPatternName: 'Halo Campanológico de 6 Parciales',
    oscillatorsConfig: [
      osc({ f: 108, name: 'Hum Campana 0.5× (108 Hz)', color: '#6366f1', vol: 0.42, y: -0.6 }),
      osc({ f: 216, name: 'Prime A (216 Hz)', color: '#818cf8', vol: 0.38, x: -0.35 }),
      osc({ f: 217.2, name: 'Doblete Cuenco B (217.2 Hz)', color: '#a5b4fc', vol: 0.35, x: 0.35 }),
      osc({ f: 259.2, name: 'Tierce 6:5 (259.2 Hz)', color: '#c084fc', vol: 0.25, x: -0.6 }),
      osc({ f: 324, name: 'Quint 3:2 (324 Hz)', color: '#38bdf8', vol: 0.28, x: 0.6 }),
      osc({ f: 432, name: 'Nominal 2× (432 Hz)', color: '#fcd34d', vol: 0.24, y: 0.6 })
    ],
    technicalRecommendation: {
      recommendedMediums: ['acustica'],
      primaryMediumLabel: 'Acústica Envolvente 3D (Baño Sonoro Completo)',
      usageMode: 'Ideal en altavoces estéreo o auriculares abiertos para baños de sonido, relajación profunda, yoga nidra y armonización de espacios.',
      recommendedVolume: '28% - 46%',
      recommendedDuration: '20 - 60 min',
      numerologyRelation: 'Δ_doblete = 1.2 Hz · Serie 108 × {1, 2, 2.4, 3, 4}',
      harmonicEquation: 'H_total = Hum(108) + Prime(216±1.2) + Tierce(259.2) + Quint(324) + Nominal(432)',
      naturalObjectResonance: 'Campanas de bronce Cu₈₀Sn₂₀ y cuencos ceremoniales'
    }
  }
];

export const frequencyData: FrequencyItem[] = rawFrequencyData.map(completeParticle);

/**
 * Devuelve la configuración exacta de osciladores para cualquier partícula,
 * lista para inyectarse directamente en el motor Web Audio / 3D / Mesh.
 */
export const getParticleOscillators = (item: FrequencyItem): Partial<OscillatorState>[] => {
  if (item.oscillatorsConfig && item.oscillatorsConfig.length > 0) {
    return item.oscillatorsConfig.map(o => ({ ...o }));
  }

  let freq = item.numericalHz;
  if (!freq || freq <= 0) {
    const match = item.hz.match(/[\d.]+/);
    freq = match ? parseFloat(match[0]) : 432;
  }

  return [
    {
      name: item.name,
      frequency: freq,
      type: 'sine',
      volume: 0.5,
      panX: 0,
      panY: 0,
      panZ: 0,
      isIndependent: freq < 20,
      color: CATEGORY_COLORS[item.category] || '#38bdf8'
    }
  ];
};
