import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';

/** Factor TOTP recién creado, pendiente de confirmar con el primer código. */
export interface FactorPendiente {
  factorId: string;
  /** QR en SVG (data URL) generado por Supabase. */
  qr: string;
  secreto: string;
}

/**
 * Alta y baja de la verificación en dos pasos (TOTP) del usuario actual.
 * Leer el estado y verificar un código al iniciar sesión siguen en AuthService,
 * porque los usan los guards.
 */
@Injectable({ providedIn: 'root' })
export class DosPasosService {
  private readonly supabase = inject(SupabaseService);

  private get mfa() {
    return this.supabase.client.auth.mfa;
  }

  /** true si la cuenta tiene un factor TOTP verificado. Si la consulta falla, false. */
  async tieneFactorVerificado(): Promise<boolean> {
    const { data } = await this.mfa.listFactors();
    return !!data?.totp?.some(f => f.status === 'verified');
  }

  /** Borra intentos sin terminar y crea un factor nuevo. null si Supabase lo rechaza. */
  async iniciarAlta(): Promise<FactorPendiente | null> {
    const { data: lista } = await this.mfa.listFactors();
    for (const f of lista?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await this.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await this.mfa.enroll({ factorType: 'totp', friendlyName: `PacamaraQS ${Date.now()}` });
    if (error || !data) return null;
    return { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
  }

  /** Confirma el factor con su primer código. false si el código no es válido. */
  async confirmarAlta(factorId: string, codigo: string): Promise<boolean> {
    const { error } = await this.mfa.challengeAndVerify({ factorId, code: codigo });
    return !error;
  }

  /** Descarta un factor sin confirmar. Nunca lanza error. */
  async cancelarAlta(factorId: string): Promise<void> {
    await this.mfa.unenroll({ factorId }).catch(() => undefined);
  }

  /** Quita todos los factores TOTP (después de verificar un código válido). */
  async quitarTodos(): Promise<void> {
    const { data: lista } = await this.mfa.listFactors();
    for (const f of lista?.totp ?? []) await this.mfa.unenroll({ factorId: f.id });
  }
}
