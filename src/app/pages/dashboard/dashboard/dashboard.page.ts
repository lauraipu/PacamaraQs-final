import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
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
  ToastController
} from '@ionic/angular';
import { AuthService } from '../../../core/services/auth';
import { SesionService } from '../../../core/services/sesion';
import { SupabaseService } from '../../../core/services/supabase';
import { EstadoSesion, getFormatoById, Sesion } from '../../../core/models/sesion.model';

interface SesionItemUi {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  rol: string;
  fecha: string;
  cantMuestras: number;
  cantCatadores: number;
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
    CommonModule,
    FormsModule
  ]
})
export class DashboardPage implements OnInit {
  codigoInput = '';
  nombreUsuario = 'Catador';
  isJoining = false;
  isSigningOut = false;
  cargandoPerfil = true;
  sesiones: SesionItemUi[] = [];
  cargando = true;

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly sesionService = inject(SesionService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastController = inject(ToastController);

  ngOnInit(): void {
    void this.cargarSesionesReales();
    void this.cargarNombreUsuario();
  }

  async cargarSesionesReales(): Promise<void> {
    this.cargando = true;
    try {
      const { user } = await this.authService.getUser();
      if (!user) throw new Error('Debes iniciar sesión para ver tus sesiones.');

      const sesiones = await this.sesionService.obtenerMisSesiones(user.id);
      this.sesiones = sesiones.map(sesion => this.mapearSesion(sesion));
    } catch (error) {
      this.sesiones = [];
      await this.mostrarToast(
        error instanceof Error ? error.message : 'No se pudieron cargar tus sesiones.'
      );
    } finally {
      this.cargando = false;
    }
  }

  async nuevaSesion(): Promise<void> {
    await this.router.navigateByUrl('/session/create');
  }

  async unirseSesion(): Promise<void> {
    if (!this.codigoInput.trim()) {
      await this.mostrarToast('Ingresa el código de la sesión.');
      return;
    }

    this.isJoining = true;
    try {
      const { sesion } = await this.sesionService.unirseASesion(
        this.codigoInput,
        this.nombreUsuario
      );
      await this.router.navigate(['/session/waiting', sesion.id]);
    } catch (error) {
      await this.mostrarToast(
        error instanceof Error ? error.message : 'No se pudo unir a la sesión.'
      );
    } finally {
      this.isJoining = false;
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
    }
  }

  private async mostrarToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3500,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }

  private async cargarNombreUsuario(): Promise<void> {
    try {
      const { user } = await this.authService.getUser();
      if (!user) throw new Error('No se encontró el usuario autenticado.');

      if (user.is_anonymous) {
        this.nombreUsuario = 'Catador Invitado';
        return;
      }

      const { data, error } = await this.supabaseService.client
        .from('Usuarios')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;

      const nombrePerfil = data?.['nombre'];
      const nombreMetadata = user.user_metadata['nombre'];
      this.nombreUsuario = typeof nombrePerfil === 'string' && nombrePerfil.trim()
        ? nombrePerfil.trim()
        : typeof nombreMetadata === 'string' && nombreMetadata.trim()
          ? nombreMetadata.trim()
          : user.email?.split('@')[0] ?? 'Catador';
    } catch (error) {
      await this.mostrarToast(
        error instanceof Error ? error.message : 'No se pudo cargar tu perfil.'
      );
    } finally {
      this.cargandoPerfil = false;
    }
  }

  private mapearSesion(sesion: Sesion): SesionItemUi {
    const estado = {
      [EstadoSesion.EN_ESPERA]: 'En espera',
      [EstadoSesion.INICIADA]: 'En progreso',
      [EstadoSesion.FINALIZADA]: 'Completada',
      [EstadoSesion.CANCELADA]: 'Cancelada'
    }[sesion.estado];

    return {
      id: sesion.id,
      titulo: sesion.nombre,
      tipo: getFormatoById(sesion.formato).titulo,
      estado,
      rol: 'Organizador',
      fecha: sesion.creadaEn ? new Date(sesion.creadaEn).toLocaleDateString() : '—',
      cantMuestras: sesion.numeroMuestras,
      cantCatadores: sesion.catadoresObjetivo
    };
  }
}
