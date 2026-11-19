import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController, IonModal, IonSpinner, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput,
  IonRange, IonSelect, IonSelectOption, IonTitle, IonToggle, IonToolbar, ToastController, ViewWillEnter
} from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline, pencilOutline } from 'ionicons/icons';
import { CierreSesionService } from '@core/auth/cierre-sesion.service';
import { LONGITUD_MINIMA_CONTRASENA, primerRequisitoFaltante } from '@domain/contrasena/politica-contrasena';
import { Idioma, IDIOMAS, IdiomaService } from '@core/i18n/idioma.service';
import { AuthService } from '@core/auth/auth.service';
import { DosPasosService } from '@core/auth/dos-pasos.service';
import { PerfilRepository } from '../../data-access/perfil.repository';
import { Perfil, Preferencias } from '../../models/perfil.model';
import { CampoContrasenaComponent } from '@shared/components/campo-contrasena/campo-contrasena.component';

import { BotonGuiaComponent } from '@shared/components/boton-guia/boton-guia.component';
import { CodigoOtpComponent } from '@shared/components/codigo-otp/codigo-otp.component';
addIcons({ chevronDownOutline, chevronUpOutline, pencilOutline });

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.page.html',
  styleUrls: ['./configuracion.page.scss'],
  standalone: true,
  imports: [BotonGuiaComponent, CodigoOtpComponent, 
    FormsModule, TranslocoPipe, CampoContrasenaComponent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonModal, IonSpinner, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption, IonToggle, IonRange
  ]
})
export class ConfiguracionPage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly perfil = inject(PerfilRepository);
  private readonly dosPasos = inject(DosPasosService);
  private readonly transloco = inject(TranslocoService);
  private readonly alertas = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly cierreSesion = inject(CierreSesionService);
  readonly idioma = inject(IdiomaService);
  readonly idiomas = IDIOMAS;

  /** Signal: la app es zoneless; una propiedad normal asignada tras un await no repinta la vista. */
  readonly nombre = signal('');
  readonly correo = computed(() => this.auth.usuario()?.email ?? '');
  readonly guardando = signal(false);
  readonly editandoNombre = signal(false);
  private nombreOriginal = '';
  readonly cambioContrasenaAbierto = signal(false);
  readonly nuevaContrasena = signal('');
  readonly dosPasosActivo = signal(false);
  readonly dosPasosObligatorio = signal(false);
  readonly modalDosPasos = signal(false);
  readonly qrDosPasos = signal<SafeUrl | null>(null);
  readonly secretoDosPasos = signal('');
  readonly codigoDosPasos = signal('');
  readonly activandoDosPasos = signal(false);
  private factorPendiente: string | null = null;
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  readonly altoContraste = signal(false);
  readonly tamanoTexto = signal(100);
  readonly reducirAnimaciones = signal(false);
  private cargado = false;

  constructor() {
    // Aplica las preferencias al instante y las guarda en la cuenta.
    effect(() => {
      const prefs: Preferencias = {
        altoContraste: this.altoContraste(), tamanoTexto: this.tamanoTexto(), reducirAnimaciones: this.reducirAnimaciones()
      };
      const raiz = document.documentElement;
      raiz.classList.toggle('high-contrast', !!prefs.altoContraste);
      raiz.classList.toggle('a11y-sin-animaciones', !!prefs.reducirAnimaciones);
      raiz.style.fontSize = `${prefs.tamanoTexto}%`;
      if (this.cargado) void this.guardarPreferencias(prefs);
    });
  }

  async ionViewWillEnter(): Promise<void> {
    this.cargado = false;
    const id = this.auth.usuario()?.id;
    if (!id) return;
    let data: Perfil | null;
    try {
      data = await this.perfil.obtener(id);
    } catch {
      await this.avisar('config.errores.cargar');
      return;
    }
    this.nombre.set(data?.nombre ?? this.auth.usuario()?.nombre ?? '');
    const prefs: Preferencias = data?.preferencias ?? {};
    this.altoContraste.set(!!prefs.altoContraste);
    this.tamanoTexto.set(prefs.tamanoTexto ?? 100);
    this.reducirAnimaciones.set(!!prefs.reducirAnimaciones);
    if (data?.idioma && data.idioma !== this.idioma.actual()) this.idioma.cambiar(data.idioma);
    this.dosPasosActivo.set(await this.dosPasos.tieneFactorVerificado());
    // Un administrador sin verificación en dos pasos llega aquí desde roleGuard.
    if (this.route.snapshot.queryParamMap.get('dosPasos') === 'requerido' && !this.dosPasosActivo()) {
      this.dosPasosObligatorio.set(true);
      await this.avisar('dos_pasos.obligatorio_admin', 'medium');
      await this.iniciarActivacion();
    }
    queueMicrotask(() => (this.cargado = true));
  }

  editarNombre(): void {
    this.nombreOriginal = this.nombre();
    this.editandoNombre.set(true);
  }

  cancelarNombre(): void {
    this.nombre.set(this.nombreOriginal);
    this.editandoNombre.set(false);
  }

  async guardarPerfil(): Promise<void> {
    const id = this.auth.usuario()?.id;
    if (!id || this.guardando()) return;
    if (this.nombre().trim().length < 2) { await this.avisar('config.errores.nombre'); return; }
    this.guardando.set(true);
    let guardado: string;
    try {
      guardado = await this.perfil.guardarNombre(id, this.nombre());
    } catch {
      this.guardando.set(false);
      await this.avisar('config.errores.guardar');
      return;
    }
    this.guardando.set(false);
    this.nombre.set(guardado); // ya normalizado por el trigger (mayúscula inicial)
    this.editandoNombre.set(false);
    await this.avisar('config.guardado', 'success');
  }

  async guardarIdioma(valor: Idioma): Promise<void> {
    this.idioma.cambiar(valor); // Transloco cambia al instante
    const id = this.auth.usuario()?.id;
    if (!id) return;
    await this.perfil.guardarIdioma(id, valor).catch(() => this.avisar('config.errores.guardar'));
  }

  async guardarContrasena(): Promise<void> {
    const faltante = primerRequisitoFaltante(this.nuevaContrasena(), { nombre: this.nombre(), email: this.correo() });
    if (faltante) {
      const req = this.transloco.translate(`contrasena.req_${faltante}`, { n: LONGITUD_MINIMA_CONTRASENA });
      await this.avisarTexto(this.transloco.translate('contrasena.errores.falta', { req }));
      return;
    }
    try {
      await this.auth.actualizarContrasena(this.nuevaContrasena());
      this.nuevaContrasena.set('');
      this.cambioContrasenaAbierto.set(false);
      await this.avisar('recuperar.actualizada', 'success');
    } catch {
      await this.avisar('contrasena.errores.generico');
    }
  }

  async gestionar2fa(): Promise<void> {
    if (this.dosPasosActivo()) await this.desactivarDosPasos();
    else await this.iniciarActivacion();
  }

  /** Paso 1: crea el factor TOTP y muestra el QR para la app de autenticación. */
  async iniciarActivacion(): Promise<void> {
    // Borra intentos anteriores sin terminar y crea un factor nuevo.
    const factor = await this.dosPasos.iniciarAlta();
    if (!factor) { await this.avisar('dos_pasos.errores.activar'); return; }
    this.factorPendiente = factor.factorId;
    // El QR es un SVG generado por Supabase (data URL); Angular lo bloquearía sin esto.
    this.qrDosPasos.set(this.sanitizer.bypassSecurityTrustUrl(factor.qr));
    this.secretoDosPasos.set(factor.secreto);
    this.codigoDosPasos.set('');
    this.modalDosPasos.set(true);
  }

  escribirCodigo(valor: string | null | undefined): void {
    this.codigoDosPasos.set((valor ?? '').replace(/\D/g, '').slice(0, 6));
  }

  /** Paso 2: confirma con el primer código de 6 dígitos. */
  async confirmarActivacion(): Promise<void> {
    if (!this.factorPendiente || this.activandoDosPasos()) return;
    if (this.codigoDosPasos().length !== 6) { await this.avisar('dos_pasos.errores.formato'); return; }
    this.activandoDosPasos.set(true);
    const valido = await this.dosPasos.confirmarAlta(this.factorPendiente, this.codigoDosPasos());
    this.activandoDosPasos.set(false);
    if (!valido) { this.codigoDosPasos.set(''); await this.avisar('dos_pasos.errores.codigo'); return; }
    this.factorPendiente = null;
    this.dosPasosActivo.set(true);
    this.dosPasosObligatorio.set(false);
    this.modalDosPasos.set(false);
    await this.avisar('dos_pasos.activada', 'success');
  }

  async cancelarActivacion(): Promise<void> {
    this.modalDosPasos.set(false);
    if (this.factorPendiente) {
      await this.dosPasos.cancelarAlta(this.factorPendiente);
      this.factorPendiente = null;
    }
  }

  async copiarSecreto(): Promise<void> {
    await navigator.clipboard?.writeText(this.secretoDosPasos()).catch(() => undefined);
    await this.avisar('dos_pasos.copiado', 'success');
  }

  /** Desactivar exige un código válido; los administradores no pueden desactivarla. */
  private async desactivarDosPasos(): Promise<void> {
    if (this.auth.esAdmin()) { await this.avisar('dos_pasos.admin_no_desactiva', 'medium'); return; }
    const t = (c: string) => this.transloco.translate(c);
    const alerta = await this.alertas.create({
      header: t('dos_pasos.desactivar_titulo'),
      message: t('dos_pasos.desactivar_texto'),
      inputs: [{ name: 'codigo', type: 'text', placeholder: '000000', attributes: { inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code' } }],
      buttons: [{ text: t('comun.confirmar_salida.cancelar'), role: 'cancel' }, { text: t('dos_pasos.desactivar'), role: 'confirm' }]
    });
    await alerta.present();
    const { role, data } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;
    const codigo = String(data?.values?.codigo ?? '').replace(/\D/g, '');
    try {
      await this.auth.verificarCodigoDosPasos(codigo);
      await this.dosPasos.quitarTodos();
      this.dosPasosActivo.set(false);
      await this.avisar('dos_pasos.desactivada', 'success');
    } catch {
      await this.avisar('dos_pasos.errores.codigo');
    }
  }

  async cerrarEnTodos(): Promise<void> {
    if (!(await this.confirmar('config.cerrar_todos', 'config.cerrar_todos_mensaje'))) return;
    await this.auth.signOut('global').catch(() => undefined);
    await this.cierreSesion.irAlLogin();
  }

  async confirmarCerrarSesion(): Promise<void> {
    await this.cierreSesion.confirmarYSalir();
  }

  private async guardarPreferencias(preferencias: Preferencias): Promise<void> {
    // Combina en el servidor: no borra otras claves (p. ej. las guías vistas).
    await this.perfil.guardarPreferencias(preferencias)
      .catch(error => console.error('[Configuración] preferencias:', error));
  }

  private async confirmar(titulo: string, mensaje: string): Promise<boolean> {
    const t = (c: string) => this.transloco.translate(c);
    const alerta = await this.alertas.create({
      header: t(titulo), message: t(mensaje),
      buttons: [{ text: t('comun.confirmar_salida.cancelar'), role: 'cancel' }, { text: t('config.confirmar'), role: 'confirm' }]
    });
    await alerta.present();
    return (await alerta.onDidDismiss()).role === 'confirm';
  }

  private avisar(clave: string, color: 'danger' | 'success' | 'medium' = 'danger'): Promise<void> {
    return this.avisarTexto(this.transloco.translate(clave), color);
  }

  private async avisarTexto(message: string, color: 'danger' | 'success' | 'medium' = 'danger'): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}
