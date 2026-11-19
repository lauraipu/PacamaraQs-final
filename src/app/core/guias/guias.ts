import {
  accessibilityOutline, addCircleOutline, cameraOutline, checkmarkCircleOutline, checkmarkDoneOutline, createOutline,
  downloadOutline, keyOutline, layersOutline, optionsOutline, peopleOutline, podiumOutline, saveOutline, scanOutline,
  sendOutline, shareSocialOutline, shieldCheckmarkOutline, statsChartOutline
} from 'ionicons/icons';

/** Guías de primer uso. Los textos están en i18n: guias.<id>.<n>.titulo / .texto */
export const GUIAS = {
  dashboard: ['add-circle-outline', 'key-outline', 'scan-outline'],
  sala: ['share-social-outline', 'checkmark-done-outline', 'people-outline'],
  formulario: ['layers-outline', 'options-outline', 'save-outline', 'send-outline'],
  resultados: ['podium-outline', 'stats-chart-outline', 'download-outline'],
  escaner: ['camera-outline', 'create-outline', 'checkmark-circle-outline'],
  configuracion: ['shield-checkmark-outline', 'accessibility-outline']
} as const;

export type IdGuia = keyof typeof GUIAS;

export const ICONOS_GUIAS = {
  accessibilityOutline, addCircleOutline, cameraOutline, checkmarkCircleOutline, checkmarkDoneOutline, createOutline,
  downloadOutline, keyOutline, layersOutline, optionsOutline, peopleOutline, podiumOutline, saveOutline, scanOutline,
  sendOutline, shareSocialOutline, shieldCheckmarkOutline, statsChartOutline
};
