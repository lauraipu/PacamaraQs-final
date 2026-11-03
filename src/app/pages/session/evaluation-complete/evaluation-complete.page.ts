import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, lockClosedOutline } from 'ionicons/icons';

import {
  IonContent,
  IonIcon,
  IonButton,
  NavController
} from '@ionic/angular';

import { SupabaseService } from '../../../core/services/supabase';

addIcons({ checkmarkCircleOutline, lockClosedOutline });

@Component({
  selector: 'app-evaluation-complete',
  templateUrl: './evaluation-complete.page.html',
  styleUrls: ['./evaluation-complete.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonButton
  ]
})
export class EvaluationCompletePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService).client;
  private navCtrl = inject(NavController);

  sesionId = '';
  esOrganizador = false;
  nombreSesion = '';
  codigoSesion = '';
  error: string | null = null;
  cargando = true;

  async ngOnInit() {
    this.sesionId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!this.sesionId) {
      this.error = 'No se encontró el ID de la sesión.';
      this.cargando = false;
      return;
    }

    try {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      const { data: sesion, error: sesionError } = await this.supabase
        .from('sesiones')
        .select('nombre, organizador_id')
        .eq('id', this.sesionId)
        .maybeSingle();
      if (sesionError) throw sesionError;
      if (!sesion) throw new Error('No se encontró la sesión.');

      this.nombreSesion = sesion.nombre;
      this.esOrganizador = sesion.organizador_id === user.id;

      if (this.esOrganizador) {
        const { data: codigo, error: codigoError } = await this.supabase
          .from('sesiones')
          .select('codigo_sesion')
          .eq('id', this.sesionId)
          .eq('organizador_id', user.id)
          .maybeSingle();
        if (codigoError) throw codigoError;
        this.codigoSesion = codigo?.codigo_sesion ?? '';
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cargar la sesión.';
    } finally {
      this.cargando = false;
    }
  }

  async irAResultados(): Promise<void> {
    if (!this.esOrganizador || !this.sesionId) return;
    await this.router.navigateByUrl(`/session/${this.sesionId}/results`);
  }

  volverAlPanel() {
    this.navCtrl.navigateRoot('/dashboard');
  }
}