import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-extrinsic-form',
  templateUrl: './extrinsic-form.page.html',
  styleUrls: ['./extrinsic-form.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ExtrinsicFormPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
