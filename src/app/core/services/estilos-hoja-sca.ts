/**
 * Hoja de estilos de la hoja SCA impresa (Formato Combinado / Descriptivo).
 *
 * Vive en TypeScript y no en el .scss de la página porque se inyecta en el
 * iframe aislado de ImpresionService: los estilos encapsulados de Angular no
 * llegan ahí. Medidas en mm para que la hoja encaje en un A4 vertical
 * (194 × 282 mm útiles con márgenes de 8 mm).
 */
export const ESTILOS_HOJA_SCA = `
  @page sca { size: A4 portrait; margin: 8mm 8mm 7mm; }
  .sca-page {
    page: sca;
    --sca-ink: #2b2f35;
    --sca-slate: #3a3f47;
    --sca-line: 0.3mm solid #3a3f47;
    color: var(--sca-ink);
    font: 500 7pt/1.25 "Helvetica Neue", Helvetica, Arial, sans-serif;
    break-after: page;
    page-break-after: always;
  }
  .sca-page:last-child { break-after: auto; page-break-after: auto; }
  .sca-page p { margin: 0; }

  /* ── Cabecera ───────────────────────────────────────────────────────── */
  .sca-head { display: grid; grid-template-columns: 1fr; gap: 4mm; align-items: end; margin-bottom: 2.5mm; }
  .sca-page--combinado .sca-head { grid-template-columns: 1fr 74mm; }
  .sca-head__brand { font-size: 8pt; font-weight: 600; color: #555b63; }
  .sca-head h1 { margin: 0.4mm 0 2mm; color: var(--sca-slate); font-size: 21pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.05; }
  .sca-fields { display: grid; grid-template-columns: 1.55fr 1fr; gap: 2.2mm 6mm; }
  .sca-field { display: flex; align-items: baseline; gap: 1.8mm; font-size: 9pt; }
  .sca-field span { color: var(--sca-slate); font-weight: 700; white-space: nowrap; }
  .sca-field b {
    flex: 1; min-height: 4mm; padding: 0 1mm 0.3mm;
    border-bottom: 0.3mm dotted var(--sca-slate);
    font-size: 8.5pt; font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .sca-legend { padding: 1.4mm 2mm; border: var(--sca-line); }
  .sca-legend > p { margin-bottom: 1mm; font-size: 6pt; font-weight: 800; }
  .sca-legend ol {
    display: grid; grid-auto-flow: column; grid-template-rows: repeat(3, auto);
    gap: 0.5mm 1.6mm; margin: 0; padding: 0; list-style: none; font-size: 4.3pt; white-space: nowrap;
  }
  .sca-legend i {
    display: inline-grid; place-items: center; width: 2.5mm; height: 2.5mm; margin-right: 0.6mm;
    border: 0.2mm solid var(--sca-ink); border-radius: 50%; font-size: 4pt; font-style: normal; vertical-align: middle;
  }

  /* ── Consolidado del panel ──────────────────────────────────────────── */
  .sca-kpis { display: flex; flex-wrap: wrap; gap: 1.2mm 2mm; margin-bottom: 2mm; }
  .sca-kpi { flex: 0 1 44mm; padding: 1mm 2.2mm; border: var(--sca-line); border-radius: 1.5mm; }
  .sca-kpi strong { display: block; color: #c2410c; font-size: 11pt; font-weight: 800; }
  .sca-kpi span { color: #555b63; font-size: 5.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .sca-kpis__note { flex-basis: 100%; color: #555b63; font-size: 5.6pt; }

  /* ── Barras de sección ──────────────────────────────────────────────── */
  .sca-bars { display: grid; grid-template-columns: 1fr 3mm 33%; align-items: center; }
  .sca-bars__left { display: flex; align-items: center; gap: 1.4mm; grid-column: 1; }
  .sca-bars__right { grid-column: 3; }
  .sca-bars--desc { display: flex; gap: 1.4mm; }
  .sca-bar {
    display: inline-block; padding: 1.2mm 2.4mm; background: var(--sca-slate); color: #fff;
    font-size: 8pt; font-weight: 700; letter-spacing: 0.01em; white-space: nowrap;
  }
  .sca-bar--block { display: block; }
  .sca-bar--muestra em { margin-left: 2mm; padding: 0 2mm; background: #fff; color: var(--sca-slate); font-style: normal; }
  .sca-roast { position: relative; flex: 1; height: 3.2mm; background: linear-gradient(90deg, #f3f3f5, var(--sca-slate)); }
  .sca-roast em { position: absolute; top: 50%; left: 2mm; transform: translateY(-50%); color: var(--sca-slate); font-size: 6pt; font-style: normal; font-weight: 800; }

  /* ── Rejilla del Formato Combinado (Parte 1 | Parte 2) ──────────────── */
  .sca-comb { display: grid; grid-template-columns: 1fr 3mm 33%; }
  .sca-comb > .sca-l { grid-column: 1; }
  .sca-comb > .sca-r { grid-column: 3; }
  .sca-l, .sca-r { border: var(--sca-line); border-top: none; overflow: hidden; }
  .sca-comb > :nth-child(-n + 2) { border-top: var(--sca-line); }
  .sca-l--sliders { height: 18.5mm; display: flex; flex-direction: column; justify-content: center; gap: 0.6mm; }
  .sca-l--one { height: 8.6mm; display: flex; align-items: center; }
  .sca-l--one > .sca-attr { flex: 1; }
  .sca-h-desc { height: 35mm; }
  .sca-h-desc2 { height: 43mm; }
  .sca-h-note { height: 11mm; }
  .sca-h-boca { height: 19mm; }
  .sca-otras { height: 31mm; }
  .sca-r--circles { display: flex; flex-direction: column; justify-content: space-around; }

  /* ── Rejilla del Formato Descriptivo (atributos | notas) ────────────── */
  .sca-desc-grid { display: grid; grid-template-columns: minmax(0, 1fr) 27%; border-top: var(--sca-line); }
  .sca-desc-grid > .sca-l { grid-column: 1; }
  .sca-desc-grid > .sca-r { grid-column: 2; border-left: none; }
  .sca-desc-grid > .sca-full { grid-column: 1 / -1; height: 42mm; }
  .sca-desc-grid .sca-l--sliders { height: auto; padding: 1mm 0; }
  .sca-span2 { grid-row: span 2; }
  .sca-h-attr { height: 11mm; }
  .sca-desc-gustos { display: grid; grid-template-columns: minmax(0, 1fr) 24mm; }
  .sca-desc-gustos .sca-desc { padding-right: 1.5mm; column-gap: 2mm; }
  .sca-desc-gustos .sca-desc .sca-cb { margin-right: 0.9mm; font-size: 5.8pt; }
  .sca-desc-gustos > .sca-gustos { margin: 0; padding: 1.4mm 2mm; border-left: var(--sca-line); }

  /* ── Slider de intensidad 0–15 ──────────────────────────────────────── */
  .sca-attr { display: grid; grid-template-columns: 31mm minmax(0, 1fr); align-items: end; gap: 2mm; padding: 0.3mm 3mm 0.3mm 2.5mm; }
  .sca-attr__name b { display: block; color: var(--sca-slate); font-size: 9pt; font-weight: 800; line-height: 1.05; }
  .sca-attr__name small { display: block; margin-top: 0.3mm; font-size: 5.6pt; font-weight: 700; white-space: nowrap; }
  .sca-attr__val { display: inline-block; margin-left: 0.8mm; padding: 0 0.9mm; border-radius: 0.6mm; background: #000; color: #fff; font-size: 5.8pt; font-weight: 800; }
  .sca-slider { position: relative; padding-top: 2.3mm; }
  .sca-slider__zones span {
    position: absolute; top: 0; transform: translateX(-50%);
    font-size: 4.6pt; font-weight: 800; letter-spacing: 0.08em; color: var(--sca-slate);
  }
  .sca-slider__zones span:nth-child(1) { left: 17%; }
  .sca-slider__zones span:nth-child(2) { left: 50%; }
  .sca-slider__zones span:nth-child(3) { left: 83%; }
  .sca-slider__bar { position: relative; height: 2.3mm; background: linear-gradient(90deg, #ececef 0%, #9a9ea6 50%, var(--sca-slate) 100%); }
  .sca-slider__ticks {
    height: 1.3mm;
    border-right: 0.25mm solid var(--sca-slate);
    background:
      repeating-linear-gradient(90deg, var(--sca-slate) 0 0.25mm, transparent 0.25mm 33.3333%) top left / 100% 100% no-repeat,
      repeating-linear-gradient(90deg, var(--sca-slate) 0 0.18mm, transparent 0.18mm 6.6667%) top left / 100% 55% no-repeat;
  }
  .sca-slider__nums { position: relative; height: 2.1mm; font-size: 4.6pt; font-weight: 700; }
  .sca-slider__nums span { position: absolute; top: 0.1mm; transform: translateX(-50%); }
  .sca-slider__nums span:first-child { transform: none; }
  .sca-slider__nums span:last-child { transform: translateX(-100%); }
  /* Marca del catador: línea vertical con punta, como el trazo a mano. */
  .sca-slider__mark {
    position: absolute; top: -0.9mm; bottom: -1.6mm; width: 0.6mm;
    background: #000; transform: translateX(-50%);
  }
  .sca-slider__mark::before {
    content: ''; position: absolute; top: -1mm; left: 50%; transform: translateX(-50%);
    border: 0.9mm solid transparent; border-top: 1.1mm solid #000; border-bottom: 0;
  }

  /* ── Círculos 1–9 + FINAL ───────────────────────────────────────────── */
  .sca-circles { display: flex; align-items: center; gap: 0.45mm; padding: 0.6mm 2.4mm; }
  .sca-c {
    display: grid; place-items: center; width: 4.4mm; height: 4.4mm; flex: none;
    border: 0.25mm solid var(--sca-slate); border-radius: 50%;
    color: var(--sca-slate); font-size: 7pt; font-weight: 500;
  }
  .sca-c--on { background: var(--sca-ink); border-color: var(--sca-ink); color: #fff; font-weight: 800; }
  .sca-final {
    display: grid; place-items: center; min-width: 10.5mm; height: 4.4mm; margin-left: 1.4mm; padding: 0 1.2mm;
    border: 0.25mm solid #a3a8b0; border-radius: 3mm;
    color: #b4b9c0; font-size: 5.5pt; font-weight: 800; letter-spacing: 0.05em;
  }
  .sca-final--on { border-color: var(--sca-ink); color: var(--sca-ink); font-size: 6.5pt; letter-spacing: 0; }

  /* ── Casillas ───────────────────────────────────────────────────────── */
  .sca-desc { padding: 1.3mm 2.5mm; }
  .sca-desc--2col { columns: 2; column-gap: 3mm; }
  .sca-desc--boca { columns: 2; column-gap: 3mm; padding-top: 0.6mm; }
  .sca-desc__row { margin-bottom: 0.3mm; break-inside: avoid; white-space: nowrap; }
  .sca-cb { display: inline-flex; align-items: center; gap: 0.6mm; margin-right: 1.3mm; font-size: 6.1pt; line-height: 1.2; vertical-align: middle; }
  .sca-cb b { font-weight: 800; }
  .sca-cb small { font-size: 5.6pt; }
  .sca-cb i { position: relative; display: inline-block; flex: none; width: 2.3mm; height: 2.3mm; border: 0.25mm solid var(--sca-ink); }
  .sca-cb--on i { background: var(--sca-ink); }
  .sca-cb--on i::after {
    content: ''; position: absolute; left: 0.62mm; top: 0.12mm; width: 0.6mm; height: 1.3mm;
    border: solid #fff; border-width: 0 0.35mm 0.35mm 0; transform: rotate(45deg);
  }
  .sca-gustos { margin-top: 0.8mm; }
  /* En el Combinado los 5 gustos van en una fila para que la hoja quepa en un A4. */
  .sca-page--combinado .sca-gustos .sca-desc__row { display: inline-block; margin-right: 0.4mm; }
  .sca-label { margin-bottom: 0.6mm !important; color: var(--sca-slate); font-size: 6.6pt; font-weight: 800; }

  /* ── Notas ──────────────────────────────────────────────────────────── */
  .sca-split { display: grid; grid-template-columns: 54% minmax(0, 1fr); }
  .sca-split--boca { grid-template-columns: 40% minmax(0, 1fr); }
  .sca-split > .sca-notes { border-left: var(--sca-line); }
  .sca-notes { padding: 1.4mm 2.5mm; overflow: hidden; }
  .sca-notes__text { color: #111; font-size: 6.3pt; line-height: 1.35; white-space: pre-line; }
  .sca-otras .sca-notes__text { padding: 2mm 2.5mm; }

  /* ── Impresión global, tazas y defectos ─────────────────────────────── */
  .sca-global { display: flex; flex-direction: column; }
  .sca-global__head { padding-top: 1.2mm; border-bottom: var(--sca-line); }
  .sca-global__title { display: block; padding: 0 2.5mm; color: var(--sca-slate); font-size: 9.5pt; font-weight: 800; }
  .sca-global > .sca-notes { flex: 1; border-bottom: var(--sca-line); }
  .sca-cups { display: grid; grid-template-columns: 1.2fr 1fr; font-size: 5.6pt; }
  .sca-cups b { font-weight: 800; }
  .sca-cups__left { display: flex; flex-direction: column; justify-content: center; gap: 1mm; padding: 1.4mm 2mm; }
  .sca-cups__left > div { display: flex; align-items: center; justify-content: space-between; white-space: nowrap; }
  .sca-cups__right { padding: 1.4mm 2mm; border-left: var(--sca-line); }
  .sca-cups__right .sca-cb { margin-top: 0.6mm; font-size: 5.8pt; }
  .sca-boxes { display: inline-flex; gap: 0.3mm; margin-left: 1mm; }
  .sca-boxes i { display: inline-block; width: 2.3mm; height: 2.3mm; border: 0.25mm solid var(--sca-ink); }
  .sca-boxes i.on { background: var(--sca-ink); }

  /* ── Pie legal ──────────────────────────────────────────────────────── */
  .sca-legal { margin-top: 1.8mm; color: #555b63; font-size: 5.6pt; line-height: 1.3; }
  app-sca-report-template { display: block; }
  /* ── Afectivo (Parte 2): rejilla con recuadros y líneas como la hoja SCA ── */
  .sca-afe { display: grid; grid-template-columns: 38mm 62mm minmax(0, 1fr); margin-top: 2mm; border: var(--sca-line); }
  .sca-afe > div { border-bottom: var(--sca-line); }
  .sca-afe > div:not(:nth-child(3n)):not(.sca-afe__cups):not(.sca-afe__otras) { border-right: var(--sca-line); }
  .sca-afe__hd { padding: 1.2mm 2.4mm; background: var(--sca-slate); color: #fff; font-size: 7.5pt; font-weight: 700; }
  .sca-afe__name { display: flex; align-items: center; min-height: 13mm; padding: 0 2.5mm; }
  .sca-afe__name b { color: var(--sca-slate); font-size: 10pt; font-weight: 800; }
  .sca-afe__name--global { background: #f3f3f5; }
  .sca-afe__circ { display: flex; align-items: center; padding: 0 2mm; }
  .sca-afe__note { padding: 1.5mm 2mm; font-size: 6.5pt; line-height: 1.35;
    background: repeating-linear-gradient(transparent 0 3.6mm, #c9ccd1 3.6mm 3.8mm); }
  .sca-afe__cups { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 2mm 8mm; padding: 2mm 2.5mm; font-size: 7pt; }
  .sca-afe__cups > div { display: flex; align-items: center; gap: 2mm; }
  .sca-afe__def { flex-wrap: wrap; }
  .sca-afe__otras { grid-column: 1 / -1; min-height: 32mm; border-bottom: none !important; }
  .sca-afe__otras .sca-notes__text { padding: 1.5mm 2.5mm; }

  /* ── Extrínseco: recuadros de la hoja oficial (Cultivo, Procesamiento, Comercio, Certificaciones) ── */
  .sca-ext--break { break-before: page; page-break-before: always; }
  .sca-ext__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 2mm; }
  .sca-ext__box { border: 0.4mm solid #000; break-inside: avoid; }
  .sca-ext__box--full { grid-column: 1 / -1; }
  .sca-ext__title { margin: 0; padding: 1.2mm 2.4mm; background: var(--sca-slate); color: #fff; font-size: 8pt; font-weight: 700; letter-spacing: .02em; }
  .sca-ext__table { width: 100%; border-collapse: collapse; }
  .sca-ext__table th, .sca-ext__table td { height: 7mm; padding: 0.8mm 2mm; border-top: 0.25mm solid #000; vertical-align: bottom; font-size: 7.5pt; text-align: left; }
  .sca-ext__table th { width: 38%; border-right: 0.25mm solid #000; color: var(--sca-slate); font-weight: 700; text-transform: uppercase; font-size: 6.3pt; }
  .sca-ext__certs { display: flex; flex-direction: column; gap: 2.2mm; padding: 2.5mm; font-size: 8pt; }
  .sca-ext__otra { display: flex; gap: 2mm; align-items: baseline; }
  .sca-ext__otra b { flex: 1; min-height: 4mm; border-bottom: 0.25mm solid #000; font-weight: 500; }
  .sca-ext__notes { min-height: 30mm; margin: 0; padding: 2mm 2.5mm; font-size: 7.5pt;
    background: repeating-linear-gradient(transparent 0 5mm, #000 5mm 5.25mm); }
`;
