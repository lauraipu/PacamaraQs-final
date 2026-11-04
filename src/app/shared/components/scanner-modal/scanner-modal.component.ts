import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonLabel, IonSegment, IonSegmentButton,
  IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, ModalController, ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline, cameraOutline, checkmarkCircleOutline, closeOutline, flaskOutline, imageOutline,
  refreshOutline, sparklesOutline
} from 'ionicons/icons';
import { EstadoSesion, FormatoCva, getFormatoById } from '../../../core/models/sesion.model';
import {
  FichaEscaneada, FORMATOS_ESCANEO, FormatoEscaneo, tituloFormatoEscaneo
} from '../../../core/scanner/ficha-escaneada';
import { AuthService } from '../../../core/services/auth';
import { ImagenPreparada, ScannerService } from '../../../core/services/scanner';
import { SesionConRol, SesionService } from '../../../core/services/sesion';
import { mensajeDeError } from '../../../core/utils/errores';

export type ModoEscaneo = 'sesion' | 'muestra';

/** Resultado con el que se cierra el modal (role 'guardado'). */
export interface ResultadoEscaneo {
  /** Ruta a abrir tras guardar (resultados de la Sesión Personal). */
  destino?: string;
}

/**
 * Modal de escaneo de fichas en papel.
 *  A. Foto (cámara o galería) → B. Formato (y sesión/muestra) → C. Análisis IA
 *  → D. Revisión → Guardar.
 *
 *  · Escanear muestra: crea una Sesión Personal y abre sus resultados.
 *  · Escanear sesión: guarda la ficha en una sesión en curso donde el usuario
 *    participa (misma cola offline que los formularios).
 */
@Component({
  selector: 'app-scanner-modal',
  templateUrl: './scanner-modal.component.html',
  styleUrls: ['./scanner-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonSpinner,
    IonSegment, IonSegmentButton, IonLabel, IonSelect, IonSelectOption, IonInput, IonBadge
  ]
})
export class ScannerModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly scanner = inject(ScannerService);
  private readonly sesionService = inject(SesionService);
  private readonly authService = inject(AuthService);

  /** Se recibe por componentProps desde el dashboard. */
  @Input() modo: ModoEscaneo = 'muestra';

  readonly formatos = FORMATOS_ESCANEO;
  readonly modoSimulado = this.scanner.modoSimulado;

  readonly imagen = signal<ImagenPreparada | null>(null);
  readonly preparandoImagen = signal(false);
  readonly formato = signal<FormatoEscaneo>('combinado');
  readonly nombrePersonal = signal('');
  readonly analizando = signal(false);
  readonly guardando = signal(false);
  readonly ficha = signal<FichaEscaneada | null>(null);
  readonly error = signal<string | null>(null);

  /* Modo sesión */
  readonly cargandoSesiones = signal(false);
  readonly sesionesDisponibles = signal<SesionConRol[]>([]);
  readonly sesionId = signal<string | null>(null);
  readonly numeroMuestra = signal(1);

  readonly sesionSeleccionada = computed(() => this.sesionesDisponibles().find(s => s.id === this.sesionId()) ?? null);
  readonly muestrasSesion = computed(() =>
    Array.from({ length: this.sesionSeleccionada()?.numeroMuestras ?? 0 }, (_, i) => i + 1)
  );

  readonly paso = computed<1 | 2 | 3>(() => (this.ficha() ? 3 : this.imagen() ? 2 : 1));
  readonly titulo = computed(() => (this.modo === 'sesion' ? 'Escanear sesión' : 'Escanear muestra'));
  readonly tituloFormato = computed(() => tituloFormatoEscaneo(this.formato()));
  readonly puedeAnalizar = computed(() =>
    !!this.imagen() && !this.analizando() && (this.modo === 'muestra' || !!this.sesionSeleccionada())
  );

  constructor() {
    addIcons({
      alertCircleOutline, cameraOutline, checkmarkCircleOutline, closeOutline, flaskOutline, imageOutline,
      refreshOutline, sparklesOutline
    });
  }

  ngOnInit(): void {
    if (this.modo === 'sesion') void this.cargarSesiones();
  }

  /* ── Paso A: foto ─────────────────────────────────────────────────────── */
  async alSeleccionarArchivo(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // permite volver a elegir la misma foto
    if (!archivo) return;

    this.error.set(null);
    this.preparandoImagen.set(true);
    try {
      this.imagen.set(await this.scanner.prepararImagen(archivo));
      this.ficha.set(null);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo cargar la imagen.'));
    } finally {
      this.preparandoImagen.set(false);
    }
  }

  /* ── Paso B: formato / sesión ─────────────────────────────────────────── */
  cambiarFormato(valor: unknown): void {
    const formato = FORMATOS_ESCANEO.find(f => f.id === valor)?.id;
    if (formato) this.formato.set(formato);
  }

  cambiarSesion(valor: unknown): void {
    const id = typeof valor === 'string' ? valor : null;
    this.sesionId.set(id);
    this.numeroMuestra.set(1);
    const sesion = this.sesionesDisponibles().find(s => s.id === id);
    if (sesion) this.formato.set(this.formatoDeSesion(sesion));
  }

  cambiarMuestra(valor: unknown): void {
    const n = Number(valor);
    if (Number.isInteger(n) && n >= 1) this.numeroMuestra.set(n);
  }

  cambiarNombre(valor: unknown): void {
    this.nombrePersonal.set(typeof valor === 'string' ? valor : '');
  }

  /* ── Paso C: análisis ─────────────────────────────────────────────────── */
  async analizar(): Promise<void> {
    const imagen = this.imagen();
    if (!imagen || !this.puedeAnalizar()) return;
    this.error.set(null);
    this.analizando.set(true);
    try {
      this.ficha.set(await this.scanner.analizarFicha(imagen.base64, this.formato()));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo analizar la ficha.'));
    } finally {
      this.analizando.set(false);
    }
  }

  volverAEscanear(): void {
    this.ficha.set(null);
    this.error.set(null);
  }

  /* ── Paso D: guardar ──────────────────────────────────────────────────── */
  async guardar(): Promise<void> {
    const ficha = this.ficha();
    if (!ficha || this.guardando()) return;
    this.error.set(null);
    this.guardando.set(true);
    try {
      if (this.modo === 'muestra') {
        const sesionId = await this.scanner.guardarComoSesionPersonal(ficha, this.nombrePersonal());
        await this.avisar('Ficha guardada en una sesión personal.', 'success');
        await this.modalCtrl.dismiss({ destino: `/session/${sesionId}/results` } satisfies ResultadoEscaneo, 'guardado');
        return;
      }

      const sesion = this.sesionSeleccionada();
      if (!sesion) throw new Error('Selecciona la sesión.');
      const resultado = await this.scanner.guardarEnSesion(ficha, sesion.id, this.numeroMuestra());
      if (resultado.estado === 'rechazada') throw new Error(resultado.mensaje ?? 'El servidor rechazó la ficha.');
      await this.avisar(
        resultado.estado === 'pendiente'
          ? 'Sin conexión: la ficha quedó guardada y se enviará automáticamente.'
          : `Ficha guardada en la muestra ${this.numeroMuestra()} de "${sesion.nombre}".`,
        resultado.estado === 'pendiente' ? 'warning' : 'success'
      );
      await this.modalCtrl.dismiss({} satisfies ResultadoEscaneo, 'guardado');
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo guardar la ficha.'));
    } finally {
      this.guardando.set(false);
    }
  }

  cerrar(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  valorDe(ficha: FichaEscaneada, ruta: string): string {
    const valor = ruta.split('.').reduce<unknown>(
      (actual, clave) => (actual && typeof actual === 'object' ? (actual as Record<string, unknown>)[clave] : undefined),
      ficha.formulario
    );
    return typeof valor === 'string' && valor.trim() ? valor : '—';
  }

  /* ── Internos ─────────────────────────────────────────────────────────── */

  /**
   * Sesiones donde el usuario puede enviar fichas (lo mismo que exige RLS):
   * en progreso y como participante, o extrínsecas en espera.
   */
  private async cargarSesiones(): Promise<void> {
    const usuarioId = this.authService.usuario()?.id;
    if (!usuarioId) {
      this.error.set('Tu sesión expiró. Inicia sesión de nuevo.');
      return;
    }
    this.cargandoSesiones.set(true);
    try {
      const sesiones = await this.sesionService.obtenerMisSesiones(usuarioId);
      const disponibles = sesiones.filter(s => {
        const extrinseca = this.formatoDeSesion(s) === 'extrinseca';
        if (extrinseca) return s.estado === EstadoSesion.EN_ESPERA;
        const participa = !s.esOrganizador || s.organizadorParticipa;
        return participa && s.estado === EstadoSesion.INICIADA;
      });
      this.sesionesDisponibles.set(disponibles);
      if (disponibles.length === 1) this.cambiarSesion(disponibles[0].id);
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudieron cargar tus sesiones.'));
    } finally {
      this.cargandoSesiones.set(false);
    }
  }

  private formatoDeSesion(sesion: SesionConRol): FormatoEscaneo {
    const id = getFormatoById(sesion.formato).id;
    return id === FormatoCva.EXTRINSECA.id ? 'extrinseca' : (id as FormatoEscaneo);
  }

  private async avisar(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'bottom' });
    await toast.present();
  }
}
