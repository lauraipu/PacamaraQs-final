import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-affective-form',
  templateUrl: './affective-form.page.html',
  styleUrls: ['./affective-form.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class AffectiveFormPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
