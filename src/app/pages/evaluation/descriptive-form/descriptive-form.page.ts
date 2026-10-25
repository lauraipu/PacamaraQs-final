import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-descriptive-form',
  templateUrl: './descriptive-form.page.html',
  styleUrls: ['./descriptive-form.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class DescriptiveFormPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
