import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { BaseCataForm } from '../../../core/cva/base-cata-form';

addIcons({ arrowBackOutline });

interface FormularioExtrinseco {
  farming: {
    country: string;
    region: string;
    farmName: string;
    producers: string;
    species: string;
    variety: string;
    harvestDate: string;
    other: string;
  };
  processing: {
    processorName: string;
    wetMill: string;
    dryMill: string;
    processType: string;
    other: string;
  };
  trading: { grade: string; icoNumber: string; other: string };
  certifications: {
    c4: boolean;
    fairTrade: boolean;
    organic: boolean;
    rainforest: boolean;
    other: string;
  };
  notes: string;
}

@Component({
  selector: 'app-extrinsic-form',
  templateUrl: './extrinsic-form.page.html',
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class ExtrinsicFormPage extends BaseCataForm<FormularioExtrinseco> {
  override formulario: FormularioExtrinseco = this.crearFormularioVacio();

  override crearFormularioVacio(): FormularioExtrinseco {
    return {
      farming: {
        country: '',
        region: '',
        farmName: '',
        producers: '',
        species: '',
        variety: '',
        harvestDate: '',
        other: ''
      },
      processing: {
        processorName: '',
        wetMill: '',
        dryMill: '',
        processType: '',
        other: ''
      },
      trading: { grade: '', icoNumber: '', other: '' },
      certifications: {
        c4: false,
        fairTrade: false,
        organic: false,
        rainforest: false,
        other: ''
      },
      notes: ''
    };
  }
}
