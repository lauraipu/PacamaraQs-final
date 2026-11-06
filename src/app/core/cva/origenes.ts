/**
 * Catálogos del formulario extrínseco (SCA CVA – Extrinsic Assessment).
 * Las regiones cubren los principales orígenes de café; para un país sin
 * listado el usuario escribe la región libremente.
 */
export interface PaisCafe {
  nombre: string;
  /** Cómo se llama la división administrativa en ese país. */
  division: string;
  regiones: readonly string[];
}

export const PAISES_CAFE: readonly PaisCafe[] = [
  { nombre: 'Colombia', division: 'Departamento', regiones: ['Antioquia', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Cundinamarca', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'Santander', 'Tolima', 'Valle del Cauca'] },
  { nombre: 'Brasil', division: 'Estado', regiones: ['Minas Gerais', 'São Paulo', 'Espírito Santo', 'Bahía', 'Paraná', 'Rondônia', 'Goiás', 'Río de Janeiro', 'Mato Grosso'] },
  { nombre: 'Estados Unidos', division: 'Estado', regiones: ['Hawái', 'California', 'Puerto Rico'] },
  { nombre: 'México', division: 'Estado', regiones: ['Chiapas', 'Veracruz', 'Oaxaca', 'Puebla', 'Guerrero', 'Hidalgo', 'Nayarit', 'San Luis Potosí', 'Jalisco', 'Colima'] },
  { nombre: 'Guatemala', division: 'Departamento', regiones: ['Huehuetenango', 'Sacatepéquez (Antigua)', 'Sololá (Atitlán)', 'Chimaltenango (Acatenango)', 'Alta Verapaz (Cobán)', 'Guatemala (Fraijanes)', 'San Marcos', 'Jalapa', 'Santa Rosa'] },
  { nombre: 'Honduras', division: 'Departamento', regiones: ['Copán', 'Ocotepeque', 'Lempira', 'Intibucá', 'La Paz', 'Comayagua', 'Santa Bárbara', 'El Paraíso', 'Olancho', 'Francisco Morazán'] },
  { nombre: 'El Salvador', division: 'Departamento', regiones: ['Santa Ana', 'Ahuachapán', 'Sonsonate', 'La Libertad', 'Chalatenango', 'San Miguel', 'Usulután', 'Morazán'] },
  { nombre: 'Nicaragua', division: 'Departamento', regiones: ['Jinotega', 'Matagalpa', 'Nueva Segovia', 'Estelí', 'Madriz', 'Boaco'] },
  { nombre: 'Costa Rica', division: 'Provincia', regiones: ['San José (Tarrazú)', 'Alajuela (Valle Occidental)', 'Heredia', 'Cartago (Tres Ríos)', 'Puntarenas (Brunca)', 'Guanacaste', 'Turrialba', 'Orosi'] },
  { nombre: 'Panamá', division: 'Provincia', regiones: ['Chiriquí (Boquete)', 'Chiriquí (Volcán)', 'Chiriquí (Renacimiento)', 'Veraguas', 'Coclé'] },
  { nombre: 'Perú', division: 'Departamento', regiones: ['Cajamarca', 'Amazonas', 'San Martín', 'Junín', 'Cusco', 'Puno', 'Pasco', 'Piura', 'Huánuco'] },
  { nombre: 'Ecuador', division: 'Provincia', regiones: ['Loja', 'Zamora Chinchipe', 'Pichincha', 'Imbabura', 'El Oro', 'Manabí', 'Carchi'] },
  { nombre: 'Bolivia', division: 'Departamento', regiones: ['La Paz (Yungas, Caranavi)', 'Santa Cruz', 'Cochabamba'] },
  { nombre: 'Venezuela', division: 'Estado', regiones: ['Lara', 'Portuguesa', 'Táchira', 'Mérida', 'Trujillo'] },
  { nombre: 'República Dominicana', division: 'Provincia', regiones: ['Barahona', 'La Vega (Jarabacoa)', 'San Juan', 'Santiago'] },
  { nombre: 'Jamaica', division: 'Parroquia', regiones: ['Saint Andrew (Blue Mountains)', 'Saint Thomas', 'Portland', 'Manchester'] },
  { nombre: 'Etiopía', division: 'Región', regiones: ['Sidama', 'Yirgacheffe (Gedeo)', 'Guji', 'Jimma', 'Limu', 'Harrar', 'Kaffa', 'Bench Maji', 'Lekempti'] },
  { nombre: 'Kenia', division: 'Condado', regiones: ['Nyeri', 'Kirinyaga', "Murang'a", 'Kiambu', 'Embu', 'Meru', 'Machakos', 'Nakuru'] },
  { nombre: 'Ruanda', division: 'Provincia', regiones: ['Occidental (Lago Kivu)', 'Meridional (Huye)', 'Septentrional', 'Oriental'] },
  { nombre: 'Burundi', division: 'Provincia', regiones: ['Kayanza', 'Ngozi', 'Kirundo', 'Muyinga', 'Gitega'] },
  { nombre: 'Tanzania', division: 'Región', regiones: ['Kilimanjaro', 'Arusha', 'Mbeya', 'Ruvuma', 'Kagera'] },
  { nombre: 'Uganda', division: 'Región', regiones: ['Monte Elgon', 'Rwenzori', 'West Nile', 'Central'] },
  { nombre: 'Yemen', division: 'Gobernación', regiones: ['Haraz', 'Saná', 'Ibb', 'Bani Matar'] },
  { nombre: 'India', division: 'Estado', regiones: ['Karnataka', 'Kerala', 'Tamil Nadu', 'Andhra Pradesh'] },
  { nombre: 'Indonesia', division: 'Provincia', regiones: ['Sumatra Septentrional', 'Aceh (Gayo)', 'Java Occidental', 'Bali', 'Célebes Meridional (Toraja)', 'Flores', 'Papúa'] },
  { nombre: 'Vietnam', division: 'Provincia', regiones: ['Dak Lak', 'Lam Dong', 'Gia Lai', 'Kon Tum', 'Son La'] },
  { nombre: 'China', division: 'Provincia', regiones: ['Yunnan', 'Hainan'] },
  { nombre: 'Papúa Nueva Guinea', division: 'Provincia', regiones: ['Eastern Highlands', 'Western Highlands', 'Simbu'] },
  { nombre: 'Tailandia', division: 'Provincia', regiones: ['Chiang Mai', 'Chiang Rai'] },
  { nombre: 'Australia', division: 'Estado', regiones: ['Queensland', 'Nueva Gales del Sur'] }
];

/** Etiqueta del campo región según el país ("Departamento", "Estado"…). */
export function divisionDe(pais: string): string {
  return PAISES_CAFE.find(p => p.nombre === pais)?.division ?? 'Región';
}

export function regionesDe(pais: string): readonly string[] {
  return PAISES_CAFE.find(p => p.nombre === pais)?.regiones ?? [];
}

export const MONEDAS: readonly { codigo: string; nombre: string }[] = [
  { codigo: 'COP', nombre: 'Peso colombiano' }, { codigo: 'USD', nombre: 'Dólar estadounidense' },
  { codigo: 'EUR', nombre: 'Euro' }, { codigo: 'BRL', nombre: 'Real brasileño' }, { codigo: 'MXN', nombre: 'Peso mexicano' },
  { codigo: 'GTQ', nombre: 'Quetzal' }, { codigo: 'HNL', nombre: 'Lempira' }, { codigo: 'CRC', nombre: 'Colón costarricense' },
  { codigo: 'NIO', nombre: 'Córdoba' }, { codigo: 'PAB', nombre: 'Balboa' }, { codigo: 'PEN', nombre: 'Sol peruano' },
  { codigo: 'BOB', nombre: 'Boliviano' }, { codigo: 'DOP', nombre: 'Peso dominicano' }, { codigo: 'ETB', nombre: 'Birr etíope' },
  { codigo: 'KES', nombre: 'Chelín keniano' }, { codigo: 'RWF', nombre: 'Franco ruandés' }, { codigo: 'IDR', nombre: 'Rupia indonesia' },
  { codigo: 'VND', nombre: 'Dong vietnamita' }, { codigo: 'INR', nombre: 'Rupia india' }, { codigo: 'GBP', nombre: 'Libra esterlina' },
  { codigo: 'JPY', nombre: 'Yen' }, { codigo: 'CNY', nombre: 'Yuan' }, { codigo: 'KRW', nombre: 'Won surcoreano' },
  { codigo: 'AUD', nombre: 'Dólar australiano' }, { codigo: 'CAD', nombre: 'Dólar canadiense' }, { codigo: 'CHF', nombre: 'Franco suizo' }
];

/** Tipos de proceso (valor guardado → etiqueta). Los 3 primeros y "Otro" son los de la hoja SCA. */
export const TIPOS_PROCESO: readonly { valor: string; etiqueta: string }[] = [
  { valor: 'lavado', etiqueta: 'Lavado' },
  { valor: 'natural', etiqueta: 'Natural' },
  { valor: 'honey', etiqueta: 'Honey' },
  { valor: 'honey_amarillo', etiqueta: 'Honey amarillo' },
  { valor: 'honey_rojo', etiqueta: 'Honey rojo' },
  { valor: 'honey_negro', etiqueta: 'Honey negro' },
  { valor: 'semilavado', etiqueta: 'Semilavado (Pulped natural)' },
  { valor: 'descascarado_humedo', etiqueta: 'Descascarado húmedo (Wet hulled)' },
  { valor: 'anaerobico', etiqueta: 'Anaeróbico' },
  { valor: 'fermentacion_lactica', etiqueta: 'Fermentación láctica' },
  { valor: 'maceracion_carbonica', etiqueta: 'Maceración carbónica' },
  { valor: 'doble_fermentacion', etiqueta: 'Doble fermentación' },
  { valor: 'infusionado', etiqueta: 'Infusionado / Co-fermentado' },
  { valor: 'otro', etiqueta: 'Otro' }
];

export const etiquetaProceso = (valor: string): string =>
  TIPOS_PROCESO.find(t => t.valor === valor)?.etiqueta ?? valor;

/** "fInCa eL  mIRADOR" → "Finca El Mirador" (de, del, y… en minúscula salvo al inicio). */
const MINUSCULAS = new Set(['de', 'del', 'y', 'e', 'o', 'u']);
export function aTitulo(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es') + p.slice(1)))
    .join(' ');
}

/** Precio con su moneda: 25000, 'COP' → "$ 25.000 COP". */
export function formatearPrecio(valor: number, moneda = 'COP'): string {
  try {
    const n = new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: moneda, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(valor);
    return `${n} ${moneda}`;
  } catch {
    return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${moneda}`;
  }
}
