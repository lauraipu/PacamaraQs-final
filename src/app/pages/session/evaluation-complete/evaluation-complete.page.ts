import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';
import { SupabaseService } from '../../../core/services/supabase';

@Component({
  selector: 'app-evaluation-complete',
  templateUrl: './evaluation-complete.page.html',
  styleUrls: ['./evaluation-complete.page.scss'],
  standalone: true,
  imports: [CommonModule, IonButton, IonContent, RouterLink]
})
export class EvaluationCompletePage implements OnInit {
  esOrganizador = false;
  sesionId: string | null = null;
  error: string | null = null;

  private readonly supabase = inject(SupabaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    this.sesionId = this.route.snapshot.paramMap.get('id');
    if (!this.sesionId) {
      this.error = 'No se encontró la sesión.';
      return;
    }

    try {
      const { data: { user }, error: authError } = await this.supabase.client.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      const { data, error: sessionError } = await this.supabase.client
        .from('sesiones')
        .select('organizador_id')
        .eq('id', this.sesionId)
        .single();
      if (sessionError) throw sessionError;

      this.esOrganizador = data?.organizador_id === user.id;
    } catch {
      this.error = 'No fue posible verificar tu rol en esta sesión.';
    }
  }

  irAResultados(): void {
    if (this.sesionId) {
      void this.router.navigate(['/session', this.sesionId, 'results']);
    }
  }
}