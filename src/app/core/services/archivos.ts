import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Entrega de archivos generados (Excel, CSV).
 *  · Navegador: descarga con <a download>.
 *  · APK: el WebView de Android ignora <a download> con URLs blob, así que el
 *    archivo se escribe en la caché de la app y se abre la hoja "Compartir"
 *    de Android (Guardar en Archivos / Drive, WhatsApp, correo…).
 */
@Injectable({ providedIn: 'root' })
export class ArchivosService {
  async entregar(blob: Blob, nombre: string, tituloCompartir = nombre): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.descargarEnNavegador(blob, nombre);
      return;
    }
    const { uri } = await Filesystem.writeFile({
      path: nombre,
      data: await this.aBase64(blob),
      directory: Directory.Cache,
      recursive: true
    });
    await Share.share({ title: tituloCompartir, url: uri, dialogTitle: tituloCompartir });
  }

  private descargarEnNavegador(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private aBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '');
      lector.onerror = () => reject(lector.error ?? new Error('No se pudo leer el archivo.'));
      lector.readAsDataURL(blob);
    });
  }
}
