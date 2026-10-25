import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionComponentsComponent } from './session-components.component';

describe('SessionComponentsComponent', () => {
  let component: SessionComponentsComponent;
  let fixture: ComponentFixture<SessionComponentsComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionComponentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
