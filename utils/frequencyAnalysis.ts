import { OscillatorState, RadiationMedium, TechnicalRecommendation } from '../types';

const SPEED_OF_LIGHT = 299792458; // m/s
const SPEED_OF_SOUND_AIR = 343; // m/s at 20C
const SPEED_OF_SOUND_WATER = 1480; // m/s

export const digitalRoot = (n: number): number => {
  const digits = Math.abs(Math.round(n)).toString().split('').map(Number);
  if (digits.length === 0) return 0;
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum > 9) {
    sum = sum.toString().split('').map(Number).reduce((a, b) => a + b, 0);
  }
  return sum;
};

export const computeOpticalOctaveNm = (hz: number): { nm: number; band: string; colorHex: string } => {
  const safeHz = Math.max(0.1, hz);
  // Shift by octaves (2^n) until frequency falls inside ~300 THz (1000nm) to ~850 THz (353nm)
  let shifted = safeHz;
  let octaves = 0;
  while (shifted < 3.4e14 && octaves < 60) {
    shifted *= 2;
    octaves++;
  }
  while (shifted > 8.6e14 && octaves > -60) {
    shifted /= 2;
    octaves--;
  }
  const nm = Math.round((SPEED_OF_LIGHT / shifted) * 1e9);

  if (nm < 380) return { nm, band: 'UV-A Biofotónico', colorHex: '#a855f7' };
  if (nm < 450) return { nm, band: 'Violeta / Índigo', colorHex: '#818cf8' };
  if (nm < 495) return { nm, band: 'Azul Cian', colorHex: '#38bdf8' };
  if (nm < 570) return { nm, band: 'Verde Esmeralda', colorHex: '#34d399' };
  if (nm < 590) return { nm, band: 'Amarillo Solar', colorHex: '#facc15' };
  if (nm < 620) return { nm, band: 'Ámbar / Naranja', colorHex: '#fb923c' };
  if (nm < 750) return { nm, band: 'Rojo Profundo', colorHex: '#f87171' };
  return { nm, band: 'Infrarrojo Cercano (NIR)', colorHex: '#fb7185' };
};

export const computeAcousticWavelengths = (hz: number) => {
  const safeHz = Math.max(0.05, hz);
  const air = SPEED_OF_SOUND_AIR / safeHz;
  const water = SPEED_OF_SOUND_WATER / safeHz;

  // Find clear kHz octave (between 1 kHz and 64 kHz)
  let khzVal = safeHz;
  while (khzVal < 1000) khzVal *= 2;
  while (khzVal > 64000) khzVal /= 2;

  // Find clear MHz RF octave (between 1 MHz and 50 MHz)
  let mhzVal = safeHz;
  while (mhzVal < 1_000_000) mhzVal *= 2;
  while (mhzVal > 50_000_000) mhzVal /= 2;

  return {
    airMeters: air >= 10 ? `${air.toFixed(1)} m` : air >= 0.1 ? `${air.toFixed(2)} m` : `${(air * 100).toFixed(1)} cm`,
    waterMeters: water >= 10 ? `${water.toFixed(1)} m` : `${water.toFixed(2)} m`,
    khzOctave: `${(khzVal / 1000).toFixed(3)} kHz`,
    mhzHarmonic: `${(mhzVal / 1_000_000).toFixed(3)} MHz`
  };
};

export const autoSuggestTechnicalRecommendation = (
  oscillators: Partial<OscillatorState>[],
  category?: string,
  name?: string
): TechnicalRecommendation => {
  const validOscs = oscillators.filter(o => typeof o.frequency === 'number' && o.frequency > 0);
  const primaryFreq = validOscs[0]?.frequency || 432;
  const avgVol = validOscs.length > 0
    ? validOscs.reduce((acc, o) => acc + (o.volume ?? 0.5), 0) / validOscs.length
    : 0.5;
  const hasBinaural = validOscs.some((a, i) =>
    validOscs.slice(i + 1).some(b =>
      ((a.panX ?? 0) <= -0.15 && (b.panX ?? 0) >= 0.15) ||
      ((a.panX ?? 0) >= 0.15 && (b.panX ?? 0) <= -0.15)
    )
  );

  const optics = computeOpticalOctaveNm(primaryFreq);
  const phys = computeAcousticWavelengths(primaryFreq);
  const root = digitalRoot(primaryFreq);
  const cat = (category || '').toLowerCase();
  const titleLower = (name || '').toLowerCase();

  let recommendedMediums: RadiationMedium[] = ['acustica'];
  let primaryMediumLabel = 'Acústica Estéreo / Ambiental';
  let usageMode = 'Reproducción acústica de fondo suave o con altavoces de campo cercano.';
  let recommendedVolume = `${Math.max(15, Math.round(avgVol * 60))}–${Math.min(75, Math.round(avgVol * 90))}% (~48–62 dB SPL)`;
  let recommendedVoltage = '1.2 V – 2.8 V RMS (Salida de audio)';
  let recommendedAmperage = '40 mA – 250 mA';
  let recommendedWatts = '0.5 W – 5 W (Monitores / Transductor)';
  let recommendedDuration = '20 – 45 minutos';

  if (hasBinaural || cat === 'brain') {
    recommendedMediums = primaryFreq <= 30 ? ['acustica', 'electromagnetica'] : ['acustica'];
    primaryMediumLabel = hasBinaural
      ? 'Auriculares Estéreo (Separación Binaural L/R)'
      : 'Acústica Binaural + PEMF Cerebral Suave';
    usageMode = hasBinaural
      ? 'Utilizar audífonos estéreo para preservar la diferencia interaural sin mezcla aérea, a volumen confortable.'
      : 'Adecuada como fondo de concentración o descanso; en frecuencias < 30 Hz también funciona excelente en bobina PEMF craneal de baja intensidad.';
    recommendedVolume = '25% – 45% (Evitar fatiga auditiva en sesiones largas)';
    recommendedVoltage = '0.5 V – 5 V (Audio / Micro-PEMF)';
    recommendedAmperage = '20 mA – 180 mA';
    recommendedWatts = '0.1 W – 2 W';
  } else if (cat === 'electromagnetic' || cat === 'bioresonance' || primaryFreq >= 2000) {
    recommendedMediums = ['electromagnetica', 'ionica_plasma', 'fotonica_nir'];
    primaryMediumLabel = 'PEMF / Bobina Electromagnética + Tubo de Plasma / Fotónica';
    usageMode = primaryFreq >= 2000
      ? 'Frecuencia portadora alta: más efectiva mediante emisión electromagnética (bobina PEMF), tubo de plasma iónico o modulación fotónica que como sonido audible directo.'
      : 'Ideal para aplicación mediante bobina toroidal PEMF, transductor vibroacústico de contacto o sonido ambiental tenue.';
    recommendedVolume = primaryFreq >= 2000 ? '10% – 25% (Opcional si se usa vía acústica)' : '35% – 55%';
    recommendedVoltage = '5 V – 24 V DC (Driver PEMF) / 12 V Pulsado';
    recommendedAmperage = '250 mA – 1.5 A';
    recommendedWatts = '3 W – 18 W (Bobina) | 15–45 W (Plasma)';
    recommendedDuration = '15 – 30 minutos';
  } else if (cat === 'nature' || cat === 'body' || primaryFreq < 120) {
    recommendedMediums = ['acustica', 'magnetica', 'fotonica_nir'];
    primaryMediumLabel = 'Vibroacústica Corporal + Campo Magnético / Fotónica NIR';
    usageMode = primaryFreq < 40
      ? 'Por estar en rango infrasónico/grave, responde mejor en transductores táctiles vibroacústicos, subwoofers o bobinas magnéticas/PEMF.'
      : 'Ideal tanto como sonido orgánico de fondo como en emisión magnética o infrarroja modulada sobre agua o tejido biológico.';
    recommendedVolume = '35% – 65% (Rango grave confortable)';
    recommendedVoltage = '3.3 V – 12 V DC';
    recommendedAmperage = '150 mA – 900 mA';
    recommendedWatts = '2 W – 12 W';
  } else if (titleLower.includes('luz') || titleLower.includes('uv') || titleLower.includes('fot')) {
    recommendedMediums = ['fotonica_nir', 'fotonica_uv', 'acustica'];
    primaryMediumLabel = 'Fotónica Modulada (NIR / UV) + Acústica Armónica';
    usageMode = 'Modular matriz LED de espectro rojo/NIR o luz violeta con esta envolvente armónica; acompañable de audio suave.';
    recommendedVoltage = '3.0 V – 12 V DC (Driver LED)';
    recommendedAmperage = '300 mA – 1.2 A';
    recommendedWatts = '3 W – 15 W ópticos (20–60 mW/cm²)';
  } else {
    recommendedMediums = ['acustica', 'multimedio'];
    primaryMediumLabel = 'Acústica de Fondo / Campo Armónico Multi-Medio';
    usageMode = 'Funciona de forma fluida como sonido de fondo ambiental, meditación acústica o señal moduladora para bobinas escalares y cromoterapia.';
  }

  return {
    recommendedMediums,
    primaryMediumLabel,
    usageMode,
    frequencyScales: {
      hz: validOscs.length > 1
        ? `${validOscs.map(o => `${Number(o.frequency).toFixed(1)}`).slice(0, 4).join(' + ')} Hz`
        : `${primaryFreq.toFixed(2).replace(/\.00$/, '')} Hz`,
      khz: phys.khzOctave,
      mhz: phys.mhzHarmonic,
      opticalNm: `${optics.nm} nm (${optics.band})`
    },
    recommendedVolume,
    recommendedVoltage,
    recommendedAmperage,
    recommendedWatts,
    recommendedDuration,
    numerologyRelation: `Raíz teosófica ${root} · Octava armónica ${optics.band} (${optics.nm} nm)`,
    harmonicEquation: validOscs.length > 1
      ? `Σ f_i (${validOscs.length} capas) · λ_aire = ${phys.airMeters}`
      : `f₀ = ${primaryFreq} Hz · 2f₀ = ${(primaryFreq * 2).toFixed(1)} Hz · φf₀ = ${(primaryFreq * 1.618034).toFixed(2)} Hz`,
    naturalObjectResonance: primaryFreq < 30
      ? 'Ondas geomagnéticas terrestres y ritmos bioeléctricos neuronales'
      : 'Estructuras acuosas, cristales resonantes y cavidades acústicas naturales'
  };
};

export interface SpectrometerResonance {
  id: string;
  classification:
    | 'interferencia_binaural'
    | 'modulacion_amplitud'
    | 'acoplamiento_fase'
    | 'consonancia_armonica'
    | 'heterodino_diferencial';
  label: string;
  subtitle: string;
  deltaHz: number;
  sumHz: number;
  ratio: string;
  intervalName: string | null;
  bandName: string;
  bandDescription: string;
  sourceA: string;
  sourceB: string;
  freqA: number;
  freqB: number;
  accentColor: 'purple' | 'cyan' | 'emerald' | 'amber' | 'pink';
}

const KNOWN_RATIOS: { value: number; label: string }[] = [
  { value: 1.0, label: 'Unísono (1:1)' },
  { value: 1.125, label: 'Segunda Mayor Pitagórica (9:8)' },
  { value: 1.2, label: 'Tercera Menor Justa (6:5)' },
  { value: 1.25, label: 'Tercera Mayor Justa (5:4)' },
  { value: 1.33333, label: 'Cuarta Justa (4:3)' },
  { value: 1.41421, label: 'Intervalo √2 / Diapente Diagonal' },
  { value: 1.5, label: 'Quinta Perfecta (3:2)' },
  { value: 1.61803, label: 'Proporción Áurea (φ ≈ 1.618)' },
  { value: 1.66667, label: 'Sexta Mayor Justa (5:3)' },
  { value: 1.875, label: 'Séptima Mayor Justa (15:8)' },
  { value: 2.0, label: 'Octava Armónica (2:1)' },
  { value: 3.0, label: 'Duodécima / 3er Armónico (3:1)' },
  { value: 4.0, label: 'Doble Octava (4:1)' }
];

export const getFrequencyBandInfo = (hz: number): { name: string; desc: string } => {
  if (hz < 0.5) return { name: 'Epsilon (<0.5 Hz)', desc: 'Estado ultraprofundo de integración somática' };
  if (hz < 4) return { name: 'Delta (0.5–4 Hz)', desc: 'Regeneración celular y sueño profundo' };
  if (hz < 8) return { name: 'Theta (4–8 Hz)', desc: 'Imaginación profunda, memoria e intuición' };
  if (hz < 13) return { name: 'Alfa (8–13 Hz)', desc: 'Coherencia relajada y sincronización cortical' };
  if (hz < 30) return { name: 'Beta (13–30 Hz)', desc: 'Enfoque analítico y procesamiento activo' };
  if (hz < 100) return { name: 'Gamma (30–100 Hz)', desc: 'Unificación perceptual y lucidez neural' };
  if (hz < 250) return { name: 'Lambda / Alta (100–250 Hz)', desc: 'Resonancia estructural y armónica superior' };
  return { name: 'Espectro Audible / Portadora', desc: 'Interferencia armónica de campo acústico' };
};

export const classifyPairResonance = (
  oscA: OscillatorState,
  oscB: OscillatorState
): SpectrometerResonance | null => {
  const f1 = Math.max(0.01, oscA.frequency);
  const f2 = Math.max(0.01, oscB.frequency);
  const deltaHz = Math.abs(f1 - f2);
  const sumHz = f1 + f2;
  const fMax = Math.max(f1, f2);
  const fMin = Math.min(f1, f2);
  const rawRatio = fMax / fMin;

  // Match known harmonic/Pythagorean ratios within 1.2% tolerance
  let matchedInterval: string | null = null;
  for (const r of KNOWN_RATIOS) {
    if (Math.abs(rawRatio - r.value) / r.value <= 0.012) {
      matchedInterval = r.label;
      break;
    }
  }

  const isOppositePan =
    (oscA.panX <= -0.15 && oscB.panX >= 0.15) ||
    (oscA.panX >= 0.15 && oscB.panX <= -0.15);

  const band = getFrequencyBandInfo(deltaHz > 0.01 ? deltaHz : f1);
  const sourceA = oscA.name || `${f1} Hz`;
  const sourceB = oscB.name || `${f2} Hz`;
  const ratioStr = `${rawRatio.toFixed(3)}:1`;

  if (deltaHz <= 0.5) {
    return {
      id: `phase-${oscA.id}-${oscB.id}`,
      classification: 'acoplamiento_fase',
      label: 'Acoplamiento de Fase / Coherencia',
      subtitle: deltaHz < 0.01
        ? 'Sincronía de fase estacionaria (interferencia constructiva o cancelación escalar)'
        : `Deriva de fase ultralenta (${deltaHz.toFixed(3)} Hz)`,
      deltaHz,
      sumHz,
      ratio: ratioStr,
      intervalName: matchedInterval,
      bandName: band.name,
      bandDescription: band.desc,
      sourceA,
      sourceB,
      freqA: f1,
      freqB: f2,
      accentColor: 'emerald'
    };
  }

  if (isOppositePan && deltaHz <= 45) {
    return {
      id: `binaural-${oscA.id}-${oscB.id}`,
      classification: 'interferencia_binaural',
      label: 'Interferencia Binaural Interaural',
      subtitle: 'Integración dicótica en el complejo olivar superior (requiere estéreo L/R)',
      deltaHz,
      sumHz,
      ratio: ratioStr,
      intervalName: matchedInterval,
      bandName: band.name,
      bandDescription: band.desc,
      sourceA,
      sourceB,
      freqA: f1,
      freqB: f2,
      accentColor: 'purple'
    };
  }

  if (deltaHz <= 40) {
    return {
      id: `am-${oscA.id}-${oscB.id}`,
      classification: 'modulacion_amplitud',
      label: 'Modulación de Amplitud Acústica (Δf)',
      subtitle: 'Envolvente periódica física de interferencia constructiva/destructiva en el medio',
      deltaHz,
      sumHz,
      ratio: ratioStr,
      intervalName: matchedInterval,
      bandName: band.name,
      bandDescription: band.desc,
      sourceA,
      sourceB,
      freqA: f1,
      freqB: f2,
      accentColor: 'amber'
    };
  }

  if (matchedInterval) {
    return {
      id: `harm-${oscA.id}-${oscB.id}`,
      classification: 'consonancia_armonica',
      label: `Consonancia Armónica · ${matchedInterval}`,
      subtitle: 'Superposición estacionaria de baja entropía y nodos geométricos cerrados',
      deltaHz,
      sumHz,
      ratio: ratioStr,
      intervalName: matchedInterval,
      bandName: band.name,
      bandDescription: band.desc,
      sourceA,
      sourceB,
      freqA: f1,
      freqB: f2,
      accentColor: 'cyan'
    };
  }

  if (deltaHz <= 250) {
    return {
      id: `het-${oscA.id}-${oscB.id}`,
      classification: 'heterodino_diferencial',
      label: 'Tono Diferencial Heterodino (Tartini)',
      subtitle: 'Intermodulación diferencial f₂−f₁ y suma armónica f₁+f₂ en campo no lineal',
      deltaHz,
      sumHz,
      ratio: ratioStr,
      intervalName: null,
      bandName: band.name,
      bandDescription: band.desc,
      sourceA,
      sourceB,
      freqA: f1,
      freqB: f2,
      accentColor: 'pink'
    };
  }

  return null;
};
