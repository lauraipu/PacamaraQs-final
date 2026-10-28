import { Directive, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { SesionService } from '../services/sesion';

@Directive()
export abstract class BaseCataForm<T> implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly navCtrl = inject(NavController);
  protected readonly toastCtrl = inject(ToastController);
  protected readonly sesionService = inject(SesionService);

  totalMuestras = 1;
  muestraActual = 1;
  respuestas: T[] = [];
  abstract formulario: T;
  error: string | null = null;

  abstract crearFormularioVacio(): T;

  protected esRespuestaCompleta(_respuesta: T): boolean {
    return true;
  }

  async ngOnInit(): Promise<void> {
    if (this.respuestas.length === 0) this.respuestas = [this.formulario];

    const sesionId = this.route.snapshot.paramMap.get('sesionId')?.trim();
    if (!sesionId) {
      this.error = 'No se encontró el ID de la sesión.';
      return;
    }

    try {
      const sesion = await this.sesionService.obtenerSesionPorId(sesionId);
      if (!sesion) throw new Error('No se encontró la sesión de cata.');

      this.totalMuestras = Math.max(1, sesion.numeroMuestras);
      this.respuestas = Array.from({ length: this.totalMuestras }, () => this.crearFormularioVacio());
      this.muestraActual = 1;
      this.formulario = this.respuestas[0];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cargar la sesión.';
      console.error('Error al cargar la sesión para la evaluación:', error);
      await this.mostrarToast(this.error, 'danger');
    }
  }

  irAMuestraSiguiente(): void {
    if (!this.esRespuestaCompleta(this.formulario)) {
      void this.mostrarAvisoCalificacionIncompleta();
      return;
    }

    if (this.muestraActual >= this.totalMuestras) {
      void this.finalizarCata();
      return;
    }

    this.muestraActual++;
    this.formulario = this.respuestas[this.muestraActual - 1];
  }

  irAMuestraAnterior(): void {
    if (this.muestraActual <= 1) return;

    this.muestraActual--;
    this.formulario = this.respuestas[this.muestraActual - 1];
  }

  async finalizarCata(): Promise<void> {
    await this.mostrarToast('El guardado de evaluaciones todavía no está disponible.', 'warning');
  }

  volver(): void {
    this.navCtrl.back();
  }

  protected async mostrarAvisoCalificacionIncompleta(): Promise<void> {
    await this.mostrarToast('Por favor completa los atributos obligatorios.', 'warning');
  }

  protected async mostrarToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color });
    await toast.present();
  }
}
