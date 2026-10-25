export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'participante';
}