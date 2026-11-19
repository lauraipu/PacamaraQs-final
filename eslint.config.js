// @ts-check
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

/* ───────── Fronteras entre capas (Fase 2, paso 1) ─────────
 * domain/   → TypeScript puro: no importa Angular, Ionic, Supabase ni otra capa.
 * core/     → no importa shared/ ni features/.
 * shared/   → no importa features/, repositorios ni el cliente de Supabase.
 * features/ → no importa archivos internos de otra feature.
 * DTO (core/dto/) → solo los importan los data-access/ (repositorios y mappers):
 *              páginas, componentes, modelos y shared/ trabajan con modelos.
 * Solo revisa imports estáticos (import … from '…').
 */
const FEATURES = ["admin", "auth", "evaluacion", "perfil", "resultados", "sesiones"];

const regla = (...patrones) => ({ "no-restricted-imports": ["error", { patterns: patrones }] });

const SIN_DTO = {
  regex: "^@core/dto/|(^|/)dto/[^/]+\\.dto$",
  message: "Los DTO solo se usan en data-access/ (repositorio y mapper). Aquí usa el modelo.",
};

const reglaDeFeature = (feature) => {
  const otras = FEATURES.filter((f) => f !== feature).join("|");
  const cruzadas = {
    regex: `^@features/(?!${feature}/)|(^|/)features/(?!${feature}/)|^(\\.\\./)+(${otras})/`,
    message: `features/${feature} no puede importar archivos internos de otra feature: usa shared/ o domain/.`,
  };
  return [
    { files: [`src/app/features/${feature}/**/*.ts`], rules: regla(cruzadas) },
    {
      // Todo lo que no es data-access/ (páginas, ui, modelos, presentación, rutas) tampoco ve los DTO.
      files: [`src/app/features/${feature}/**/*.ts`],
      ignores: [`src/app/features/${feature}/data-access/**`, "**/*.spec.ts"],
      rules: regla(cruzadas, SIN_DTO),
    },
  ];
};

const CORE_SIN_CAPAS_SUPERIORES = {
  regex: "^@(shared|features)/|(^|/)(shared|features)/",
  message: "core/ no puede importar shared/ ni features/.",
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
    rules: regla(CORE_SIN_CAPAS_SUPERIORES),
  },
  {
    files: ["src/app/core/**/*.ts"],
    ignores: ["src/app/core/data-access/**", "src/app/core/dto/**", "**/*.spec.ts"],
    rules: regla(CORE_SIN_CAPAS_SUPERIORES, SIN_DTO),
  },
  {
    files: ["src/app/shared/**/*.ts"],
    rules: regla({
      regex: "^@features/|(^|/)features/|(^|/)data-access/|\\.repository$|^@supabase/|(^|/)supabase(\\.client)?$|^@core/dto/|(^|/)dto/",
      message: "shared/ no puede importar features/, repositorios, DTO ni el cliente de Supabase.",
    }),
  },
  ...FEATURES.flatMap(reglaDeFeature),
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
