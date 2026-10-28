import { inject, Injectable } from '@angular/core';
import { UsuarioDto } from '../models/evaluation.model';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
    return data;
  }

  async loginAnonimo() {
    const { data, error } = await this.supabase.client.auth.signInAnonymously();
    if (error) throw error;
    return data;
  }

  async registro(email: string, password: string, nombre: string) {
    const correo = email.trim();
    const nombreCompleto = nombre.trim();
    if (!correo || !password || !nombreCompleto) {
      throw new Error('El nombre, el correo y la contraseña son obligatorios.');
    }

    const { data: authData, error: authError } = await this.supabase.client.auth.signUp({
      email: correo,
      password,
      options: { data: { nombre: nombreCompleto } }
    });
    if (authError) throw authError;

    if (authData.user) {
      const nuevoUsuario: UsuarioDto = {
        id: authData.user.id,
        email: correo,
        nombre: nombreCompleto,
        rol_global: 'catador',
        acepto_politica_en: new Date().toISOString(),
        version_politica_aceptada: '1.0'
      };
      try {
        const { error: dbError } = await this.supabase.client
          .from('usuarios')
          .insert([nuevoUsuario]);

        if (dbError) {
          console.warn(
            '[AuthService.registro] Usuario creado en Auth pero falló INSERT en usuarios:',
            dbError
          );
        }
      } catch (dbError) {
        console.warn(
          '[AuthService.registro] Excepción al crear perfil (se ignorará):',
          dbError
        );
      }
    }
    return authData;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
  }

  async getSession() {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (error) throw error;
    return data;
  }

  async getUser() {
    const { data, error } = await this.supabase.client.auth.getUser();
    if (error) throw error;
    return data;
  }
}

export { AuthService as Auth };
