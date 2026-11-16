// Re-export the native module. On web, it will be resolved to NutriOcrModule.web.ts
// and on native platforms to NutriOcrModule.ts
export { default } from './src/NutriOcrModule';
export * from './src/NutriOcr.types';
