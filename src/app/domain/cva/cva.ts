export const RUEDA_SABORES: Record<string, { color: string; subdescriptores: string[] }> = {
  Floral: { color: '#F4B8C8', subdescriptores: ['Flor de té', 'Jazmín', 'Rosa', 'Lavanda'] },
  Afrutado: { color: '#F4A636', subdescriptores: ['Bayas', 'Frutas deshidratadas', 'Cítricos', 'Fruta de hueso', 'Coco', 'Melón'] },
  'Ácido / Fermentado': { color: '#EDD84A', subdescriptores: ['Ácido acético', 'Fermentado', 'Vinoso', 'Agrio'] },
  'Verde / Vegetal': { color: '#72B74A', subdescriptores: ['Oliva', 'Pepino', 'Hierba', 'Heno', 'Crudo'] },
  Otro: { color: '#A08060', subdescriptores: ['Madera', 'Tinta', 'Caucho'] },
  Tostado: { color: '#7B4F2E', subdescriptores: ['Cereal', 'Quemado', 'Tabaco', 'Pipa'] },
  'Nueces / Cacao': { color: '#C47A30', subdescriptores: ['Nueces', 'Cacao', 'Chocolate', 'Almendra'] },
  Especias: { color: '#E06040', subdescriptores: ['Anís', 'Pimienta', 'Canela', 'Clavo'] },
  Dulce: { color: '#D49AB8', subdescriptores: ['Vainilla', 'Azúcar morena', 'Miel', 'Caramelo'] }
};

export const DESCRIPTORES_MOUTHFEEL = [
  'Áspero (arenoso, rugoso)',
  'Aceitoso',
  'Suave (aterciopelado, sedoso)',
  'Astringente (deja seca la boca)',
  'Metálico'
];

export const TIPOS_DEFECTO = ['Mohoso / Terroso', 'Fenólico', 'Papa', 'Papel / Mohoso', 'Químico'];

export const ETIQUETAS_HEDONICAS: Record<number, string> = {
  1: 'Extremadamente baja',
  2: 'Muy baja',
  3: 'Moderadamente baja',
  4: 'Ligeramente baja',
  5: 'Ni alto ni bajo',
  6: 'Ligeramente alta',
  7: 'Moderadamente alta',
  8: 'Muy alta',
  9: 'Extremadamente alta'
};
