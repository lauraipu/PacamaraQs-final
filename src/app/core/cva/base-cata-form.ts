import { Directive, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth';
import { EvaluacionAtributo, EvaluationService } from '../services/evaluation';
import { SesionService } from '../services/sesion';

@Directive()
export abstract class BaseCataForm<T> implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly navCtrl = inject(NavController);
  protected readonly toastCtrl = inject(ToastController);
  protected readonly saveAlertCtrl = inject(AlertController);
  protected readonly authService = inject(AuthService);
  protected readonly evaluationService = inject(EvaluationService);
  protected readonly sesionService = inject(SesionService);

  totalMuestras = 1;
  muestraActual = 1;
  guardando = false;
  respuestas: T[] = [];
  abstract formulario: T;
  error: string | null = null;
  protected sesionId = '';

  abstract crearFormularioVacio(): T;

  protected esRespuestaCompleta(_respuesta: T): boolean {
    return true;
  }

  protected calcularPuntajeFinal(_respuesta: T): number | null {
    return null;
  }

  async ngOnInit(): Promise<void> {
    if (this.respuestas.length === 0) this.respuestas = [this.formulario];

    this.sesionId = this.route.snapshot.paramMap.get('sesionId')?.trim() ?? '';
    if (!this.sesionId) {
      this.error = 'No se encontró el ID de la sesión.';
      return;
    }

    try {
      const sesion = await this.sesionService.obtenerSesionPorId(this.sesionId);
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
    if (this.guardando) return;
    if (this.respuestas.some(respuesta => !this.esRespuestaCompleta(respuesta))) {
      await this.mostrarAvisoCalificacionIncompleta();
      return;
    }

    this.guardando = true;
    this.error = null;
    try {
      const guardado = await this.guardarEvaluacionEnBD(this.muestraActual, this.respuestas);
      if (!guardado) {
        const alert = await this.saveAlertCtrl.create({
          header: 'No se pudo guardar',
          message: this.error ?? 'No se pudo guardar la evaluación. Tus respuestas siguen en esta pantalla.',
          buttons: ['Volver a intentar']
        });
        await alert.present();
        return;
      }

      await this.irAPantallaFinalizacion();
    } finally {
      this.guardando = false;
    }
  }

  protected async guardarEvaluacionEnBD(muestraActual: number, respuestas: T | T[]): Promise<boolean> {
    try {
      if (!this.sesionId) throw new Error('No se encontró el ID de la sesión.');
      const { user } = await this.authService.getUser();
      if (!user) throw new Error('Debes iniciar sesión para guardar la evaluación.');

      const listaRespuestas = Array.isArray(respuestas) ? respuestas : [respuestas];
      if (listaRespuestas.length === 0) throw new Error('No hay respuestas para guardar.');

      for (const [indice, respuesta] of listaRespuestas.entries()) {
        const formulario = this.comoRegistro(respuesta);
        const defectos = this.comoRegistro(formulario['defectos']);
        const tiposDefecto = Array.isArray(formulario['tiposDefecto'])
          ? formulario['tiposDefecto']
          : [];
        const impresionGlobal = this.numeroO_nulo(formulario['impresionGlobal']);
        const evaluacionId = await this.evaluationService.crearEvaluacion({
          sesion_id: this.sesionId,
          catador_id: user.id,
          numero_muestra: listaRespuestas.length === 1 ? muestraActual : indice + 1,
          impresion_global: impresionGlobal,
          tazas_no_uniformes: this.numeroO(defectos['tazasNoUniformes']),
          tazas_defectuosas: Math.max(
            this.numeroO(defectos['tazasDefectuosas']),
            tiposDefecto.length > 0 ? 1 : 0
          ),
          puntaje_final: this.calcularPuntajeFinal(respuesta),
          notas: JSON.stringify(respuesta)
        });

        await this.evaluationService.guardarAtributos(
          evaluacionId,
          this.extraerAtributos(formulario)
        );
      }

      return true;
    } catch (error) {
      console.error('Error real al guardar en Supabase:', error);
      this.error = error instanceof Error ? error.message : 'Error desconocido al guardar la evaluación.';
      return false;
    }
  }

  protected async irAPantallaFinalizacion(): Promise<void> {
    if (!this.sesionId) {
      this.error = 'No se encontró el ID de la sesión.';
      return;
    }

    try {
      const { user } = await this.authService.getUser();
      const esOrganizador = user
        ? await this.sesionService.esOrganizadorDeSesion(this.sesionId, user.id)
        : false;
      const organizador = esOrganizador ? '1' : '0';
      await this.navCtrl.navigateRoot(
        `/session/${this.sesionId}/evaluation-complete?organizador=${organizador}`
      );
    } catch (error) {
      this.error = error instanceof Error
        ? error.message
        : 'No se pudo verificar el rol antes de finalizar la evaluación.';
      await this.mostrarToast(this.error, 'danger');
    }
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

  private extraerAtributos(formulario: Record<string, unknown>): EvaluacionAtributo[] {
    const atributos: EvaluacionAtributo[] = [];
    const atributosHedonicos = new Set([
      'fragancia', 'aroma', 'sabor', 'saborResidual', 'acidez', 'dulzor', 'sensacionEnBoca'
    ]);

    const recorrer = (valor: unknown, ruta: string): void => {
      if (!this.esRegistro(valor)) return;

      const intensidad = this.numeroO_nulo(valor['intensidad']);
      const calidad = this.numeroO_nulo(valor['calidad']);
      if (intensidad !== null || calidad !== null) {
        const atributo = ruta.replace(/^atributos\./, '');
        if (atributo) {
          atributos.push({
            atributo,
            ...(intensidad !== null ? { intensidad } : {}),
            ...(calidad !== null ? { calidad } : {})
          });
        }
        return;
      }

      for (const [clave, hijo] of Object.entries(valor)) {
        if (clave === 'defectos' || clave === 'tiposDefecto' || clave === 'mouthfeel') continue;
        if (!ruta && atributosHedonicos.has(clave) && typeof hijo === 'number' && Number.isFinite(hijo)) {
          atributos.push({ atributo: clave, calidad: hijo });
          continue;
        }
        if (this.esRegistro(hijo)) recorrer(hijo, ruta ? `${ruta}.${clave}` : clave);
      }
    };

    recorrer(formulario, '');
    return atributos;
  }

  private comoRegistro(valor: unknown): Record<string, unknown> {
    return this.esRegistro(valor) ? valor : {};
  }

  private esRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  private numeroO(valor: unknown): number {
    return this.numeroO_nulo(valor) ?? 0;
  }

  private numeroO_nulo(valor: unknown): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
  }
}
