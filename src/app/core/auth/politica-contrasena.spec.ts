import { contrasenaEsSegura, evaluarContrasena, nivelContrasena } from './politica-contrasena';

const cumple = (contrasena: string, clave: string, datos = {}) =>
  evaluarContrasena(contrasena, datos).find(r => r.clave === clave)?.cumple;

describe('politica-contrasena', () => {
  it('acepta una contraseña que cumple todas las reglas', () => {
    expect(contrasenaEsSegura('Cafe-Huila2026')).toBe(true);
  });

  it('exige al menos 10 caracteres', () => {
    expect(cumple('Ab1!xyz', 'longitud')).toBe(false);
    expect(cumple('Ab1!xyzabc', 'longitud')).toBe(true);
  });

  it('exige mayúscula, minúscula, número y símbolo', () => {
    expect(cumple('cafehuila2026!', 'mayuscula')).toBe(false);
    expect(cumple('CAFEHUILA2026!', 'minuscula')).toBe(false);
    expect(cumple('CafeHuila!!!!', 'numero')).toBe(false);
    expect(cumple('CafeHuila2026', 'simbolo')).toBe(false);
  });

  it('rechaza contraseñas con el nombre o el usuario del correo', () => {
    const datos = { nombre: 'Laura Sofia Ipuz', email: 'pacamara.qs@gmail.com' };
    expect(contrasenaEsSegura('Laura-2026xyz', datos)).toBe(false);
    expect(contrasenaEsSegura('Pacamara.qs-2026', datos)).toBe(false);
    expect(contrasenaEsSegura('Taza-Limpia#2026', datos)).toBe(true);
  });

  it('calcula el nivel del medidor', () => {
    expect(nivelContrasena('')).toBe(0);
    expect(nivelContrasena('abc')).toBe(1);
    expect(nivelContrasena('Cafe-Huila26')).toBe(3);
    expect(nivelContrasena('Cafe-Huila-Pacamara-2026')).toBe(4);
  });
});
