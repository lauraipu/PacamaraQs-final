// @ts-check
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

/* ───────── Fronteras entre capas (Fase 2, paso 1) ─────────
 * domain/   → TypeScript puro: no importa Angular, Ionic, Supabase ni otra capa.
 * core/     → no importa shared/ ni features/.
 * shared/   → no importa features/, repositorios ni el cliente de Supabase.
 * features/ → no importa archivos internos de otra feature.
 * Solo revisa imports estáticos (import … from '…').
 */
const FEATURES = ["admin", "auth", "evaluacion", "perfil", "resultados", "sesiones"];

const regla = (...patrones) => ({ "no-restricted-imports": ["error", { patterns: patrones }] });

const reglaDeFeature = (feature) => {
  const otras = FEATURES.filter((f) => f !== feature).join("|");
  return {
    files: [`src/app/features/${feature}/**/*.ts`],
    rules: regla({
      regex: `^@features/(?!${feature}/)|(^|/)features/(?!${feature}/)|^(\\.\\./)+(${otras})/`,
      message: `features/${feature} no puede importar archivos internos de otra feature: usa shared/ o domain/.`,
    }),
  };
};

const fronteras = [
  {
    files: ["src/app/domain/**/*.ts"],
    rules: regla(
      {
        regex: "^(@angular|@ionic|@capacitor|@capgo|@supabase|@jsverse)/|^(rxjs|ionicons|exceljs)(/|$)",
        message: "domain/ es TypeScript puro: sin Angular, Ionic, Capacitor, Supabase, Transloco ni RxJS.",
      },
      {
        regex: "^@(core|shared|features)/|(^|/)(core|shared|features)/",
        message: "domain/ no puede depender de core/, shared/ ni features/.",
      }
    ),
  },
  {
    files: ["src/app/core/**/*.ts"],
    rules: regla({
      regex: "^@(shared|features)/|(^|/)(shared|features)/",
      message: "core/ no puede importar shared/ ni features/.",
    }),
  },
  {
    files: ["src/app/shared/**/*.ts"],
    rules: regla({
      regex: "^@features/|(^|/)features/|(^|/)data-access/|\\.repository$|^@supabase/|(^|/)supabase(\\.client)?$",
      message: "shared/ no puede importar features/, repositorios ni el cliente de Supabase.",
    }),
  },
  ...FEATURES.map(reglaDeFeature),
];

module.exports = tseslint.config(
  {
    files: ["**/*.ts"],
    ignores: ["projects/**/*"],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/component-class-suffix": [
        "error",
        { suffixes: ["Page", "Component"] },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
  ...fronteras
);
