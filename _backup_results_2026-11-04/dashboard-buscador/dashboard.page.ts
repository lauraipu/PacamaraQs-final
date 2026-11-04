import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonFab,
  IonFabButton,
  IonIcon,
  IonModal,
  AlertController,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { keyOutline, addOutline, arrowForwardOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth';
import { SesionConRol, SesionService } from '../../../core/services/sesion';
import { SupabaseService } from '../../../core/services/supabase';
import { EstadoSesion, getFormatoById } from '../../../core/models/sesion.model';

interface SesionItemUi {
  id: string;
  titulo: string;
  formato: string;
  tipo: string;
  estado: string;
  rol: string;
  fecha: string;
  cantMuestras: number;
  cantCatadores: number;
  esOrganizador: boolean;
  organizadorParticipa: boolean;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonInput,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    CommonModule,
    FormsModule
  ]
})
export class DashboardPage implements OnInit {
  codigoInput = '';
  nombreUsuario = '';
  isJoining = false;
  isSigningOut = false;
  cargandoPerfil = true;
  isModalOpen = false;
  filtroSeleccionado: 'todas' | 'organizador' | 'catador' = 'todas';

  sesiones: SesionItemUi[] = [];
  cargando = true;
  menuSesionAbiertoId: string | null = null;
  sesionEliminandoId: string | null = null;

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private inicializando = false;
  private primeraCargaCompleta = false;

  constructor() {
    // arrow-forward-outline se usa en el modal "Unirme" y no estaba registrado.
    addIcons({ keyOutline, addOutline, arrowForwardOutline });
  }

  ngOnInit(): void {
    void this.inicializar();
  }

  ionViewWillEnter(): void {
    if (this.primeraCargaCompleta) void this.inicializar();
  }

  get sesionesFiltradas(): SesionItemUi[] {
    if (this.filtroSeleccionado === 'organizador') {
      return this.sesiones.filter(s => s.esOrganizador);
    }
    if (this.filtroSeleccionado === 'catador') {
      return this.sesiones.filter(s => !s.esOrganizador);
    }
    return this.sesiones;
  }

  private async inicializar(): Promise<void> {
    if (this.inicializando) return;
    this.inicializando = true;
    try {
      const { data: { user }, error } = await this.supabaseService.client.auth.getUser();
      if (error) throw error;
      if (!user) throw new Error('Debes iniciar sesión para ver tus sesiones.');

      await this.cargarNombreUsuario(user);
      this.cargandoPerfil = false;
      await this.cargarSesionesReales(user);
    } catch (error) {
      this.sesiones = [];
      this.cargando = false;
      this.cargandoPerfil = false;
      await this.mostrarToast(error instanceof Error ? error.message : 'No se pudieron cargar tus sesiones.');
    } finally {
      this.primeraCargaCompleta = true;
      this.inicializando = false;
      this.changeDetector.markForCheck();
    }
  }

  private async cargarSesionesReales(user: { id: string }): Promise<void> {
    this.cargando = true;
    try {
      const sesiones = await this.sesionService.obtenerMisSesiones(user.id);
      this.sesiones = sesiones.map(sesion => this.mapearSesion(sesion));
    } catch (error) {
      this.sesiones = [];
      throw error;
    } finally {
      this.cargando = false;
      this.changeDetector.markForCheck();
    }
  }

  abrirModalUnirse(): void {
    this.isModalOpen = true;
    this.changeDetector.markForCheck();
  }

  cerrarModalUnirse(): void {
    this.isModalOpen = false;
    this.codigoInput = '';
    this.changeDetector.markForCheck();
  }

  entrarASesion(sesion: SesionItemUi): void {
    this.menuSesionAbiertoId = null;

    if (sesion.estado === 'En espera' || sesion.estado === 'En progreso') {
      if (sesion.esOrganizador && !sesion.organizadorParticipa) {
        if (sesion.estado === 'En progreso') {
          void this.router.navigateByUrl(
            `/session/${sesion.id}/organizer-dashboard`,
            { replaceUrl: true }
          );
          return;
        }
      }

      if (sesion.formato.toLowerCase() === 'extrinseca') {
        void this.router.navigateByUrl(`/extrinsic-form/${sesion.id}`, { replaceUrl: true });
      } else {
        void this.router.navigateByUrl(`/session/waiting/${sesion.id}`, { replaceUrl: true });
      }
      return;
    }

    if (sesion.estado === 'Completada' && sesion.esOrganizador) {
      void this.router.navigateByUrl(`/session/${sesion.id}/results`, { replaceUrl: true });
    } else if (sesion.estado === 'Completada') {
      void this.router.navigateByUrl(
        `/session/${sesion.id}/evaluation-complete`,
        { replaceUrl: true }
      );
    } else {
      void this.mostrarToast('Esta sesión fue cancelada.');
    }
  }

  toggleMenuSesion(sesionId: string, event: Event): void {
    event.stopPropagation();
    this.menuSesionAbiertoId = this.menuSesionAbiertoId === sesionId ? null : sesionId;
  }

  async solicitarEliminarSesion(sesion: SesionItemUi, event: Event): Promise<void> {
    event.stopPropagation();
    this.menuSesionAbiertoId = null;
    if (!sesion.esOrganizador) return;

    const alert = await this.alertController.create({
      header: 'Eliminar sesión',
      message: `¿Eliminar “${sesion.titulo}”? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            void this.eliminarSesion(sesion.id);
          }
        }
      ]
    });
    await alert.present();
  }

  async nuevaSesion(): Promise<void> {
    await this.router.navigateByUrl('/session/create', { replaceUrl: true });
  }

  async unirseSesion(): Promise<void> {
    const codigoLimpio = this.codigoInput.trim().toUpperCase();
    if (!codigoLimpio) {
      await this.mostrarToast('Ingresa el código de la sesión.');
      return;
    }

    this.isJoining = true;
    try {
      const { sesion } = await this.sesionService.unirseASesion(codigoLimpio);
      this.isModalOpen = false;
      this.codigoInput = '';
      const destino = sesion.formato.toLowerCase() === 'extrinseca'
        ? `/extrinsic-form/${sesion.id}`
        : `/session/waiting/${sesion.id}`;
      await this.router.navigateByUrl(destino, { replaceUrl: true });
    } catch (error) {
      console.error('Error al unirse a la sesión:', error);
      await this.mostrarToast(
        error instanceof Error ? error.message : 'No se pudo unir a la sesión.'
      );
    } finally {
      this.isJoining = false;
      this.changeDetector.markForCheck();
    }
  }

  async cerrarSesion(): Promise<void> {
    this.isSigningOut = true;
    try {
      await this.authService.signOut();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (error) {
      await this.mostrarToast(
        error instanceof Error ? error.message : 'No se pudo cerrar la sesión.'
      );
    } finally {
      this.isSigningOut = false;
      this.changeDetector.markForCheck();
    }
  }

  private async mostrarToast(message: string, color = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3500,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  private async eliminarSesion(sesionId: string): Promise<void> {
    this.sesionEliminandoId = sesionId;
    try {
      await this.sesionService.eliminarSesion(sesionId);
      this.sesiones = this.sesiones.filter(sesion => sesion.id !== sesionId);
      await this.mostrarToast('Sesión eliminada.', 'success');
    } catch (error) {
      await this.mostrarToast(
        error instanceof Error ? error.message : 'No se pudo eliminar la sesión.'
      );
    } finally {
      this.sesionEliminandoId = null;
      this.changeDetector.markForCheck();
    }
  }

  private async cargarNombreUsuario(user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('usuarios')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;

      const nombrePerfil = data?.['nombre'];
      const nombreMetadata = user.user_metadata?.['nombre'];
      this.nombreUsuario = typeof nombrePerfil === 'string' && nombrePerfil.trim()
        ? nombrePerfil.trim()
        : typeof nombreMetadata === 'string' && nombreMetadata.trim()
          ? nombreMetadata.trim()
          : user.email?.split('@')[0] ?? 'Catador';
    } catch (error) {
      console.warn('[Dashboard] No se pudo cargar el perfil:', error);
      const nombreMetadata = user.user_metadata?.['nombre'];
      this.nombreUsuario =
        (typeof nombreMetadata === 'string' && nombreMetadata.trim() ? nombreMetadata.trim() : '') ||
        user.email?.split('@')[0] ||
        'Catador';
    }
  }

  private mapearSesion(sesion: SesionConRol): SesionItemUi {
    const estado = {
      [EstadoSesion.EN_ESPERA]: 'En espera',
      [EstadoSesion.INICIADA]: 'En progreso',
      [EstadoSesion.FINALIZADA]: 'Completada',
      [EstadoSesion.CANCELADA]: 'Cancelada'
    }[sesion.estado];

    return {
      id: sesion.id,
      titulo: sesion.nombre,
      formato: sesion.formato,
      tipo: getFormatoById(sesion.formato).titulo,
      estado,
      rol: sesion.esOrganizador ? 'Organizador' : 'Catador',
      fecha: sesion.creadaEn ? new Date(sesion.creadaEn).toLocaleDateString() : '—',
      cantMuestras: sesion.numeroMuestras,
      cantCatadores: sesion.catadoresObjetivo,
      esOrganizador: sesion.esOrganizador,
      organizadorParticipa: sesion.organizadorParticipa
    };
  }
}