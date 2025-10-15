import { describe, it, expect } from 'vitest';
import { getLanguage, isLanguageSupported, getFileExtension, LANGUAGE_MAP } from './language-utils';

describe('language-utils', () => {
  describe('LANGUAGE_MAP', () => {
    it('contains common language mappings', () => {
      expect(LANGUAGE_MAP.js).toBe('javascript');
      expect(LANGUAGE_MAP.ts).toBe('typescript');
      expect(LANGUAGE_MAP.tsx).toBe('tsx');
      expect(LANGUAGE_MAP.json).toBe('json');
      expect(LANGUAGE_MAP.html).toBe('html');
      expect(LANGUAGE_MAP.css).toBe('css');
      expect(LANGUAGE_MAP.md).toBe('markdown');
    });
  });

  describe('getLanguage', () => {
    it('detects JavaScript files', () => {
      expect(getLanguage('app.js')).toBe('javascript');
      expect(getLanguage('src/utils.js')).toBe('javascript');
    });

    it('detects TypeScript files', () => {
      expect(getLanguage('app.ts')).toBe('typescript');
      expect(getLanguage('src/App.tsx')).toBe('tsx');
    });

    it('detects JSON files', () => {
      expect(getLanguage('package.json')).toBe('json');
      expect(getLanguage('tsconfig.json')).toBe('json');
    });

    it('detects HTML files', () => {
      expect(getLanguage('index.html')).toBe('html');
    });

    it('detects CSS files', () => {
      expect(getLanguage('styles.css')).toBe('css');
    });

    it('detects Markdown files', () => {
      expect(getLanguage('README.md')).toBe('markdown');
    });

    it('is case-insensitive', () => {
      expect(getLanguage('App.JS')).toBe('javascript');
      expect(getLanguage('FILE.TS')).toBe('typescript');
    });

    it('returns "text" for unknown extensions', () => {
      expect(getLanguage('file.unknown')).toBe('text');
      expect(getLanguage('file.abc')).toBe('text');
    });

    it('returns "text" for files without extension', () => {
      expect(getLanguage('Dockerfile')).toBe('text');
      expect(getLanguage('README')).toBe('text');
    });

    it('handles paths with multiple dots', () => {
      expect(getLanguage('src/file.test.ts')).toBe('typescript');
      expect(getLanguage('components.config.js')).toBe('javascript');
    });
  });

  describe('isLanguageSupported', () => {
    it('returns true for supported languages', () => {
      expect(isLanguageSupported('app.js')).toBe(true);
      expect(isLanguageSupported('app.ts')).toBe(true);
      expect(isLanguageSupported('app.tsx')).toBe(true);
      expect(isLanguageSupported('styles.css')).toBe(true);
      expect(isLanguageSupported('index.html')).toBe(true);
    });

    it('returns false for unsupported extensions', () => {
      expect(isLanguageSupported('image.png')).toBe(false);
      expect(isLanguageSupported('file.unknown')).toBe(false);
      expect(isLanguageSupported('document.pdf')).toBe(false);
    });

    it('returns false for files without extension', () => {
      expect(isLanguageSupported('Dockerfile')).toBe(false);
      expect(isLanguageSupported('README')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isLanguageSupported('App.JS')).toBe(true);
      expect(isLanguageSupported('FILE.TS')).toBe(true);
    });
  });

  describe('getFileExtension', () => {
    it('extracts extension from simple filenames', () => {
      expect(getFileExtension('app.js')).toBe('js');
      expect(getFileExtension('styles.css')).toBe('css');
      expect(getFileExtension('index.html')).toBe('html');
    });

    it('extracts extension from paths', () => {
      expect(getFileExtension('src/components/App.tsx')).toBe('tsx');
      expect(getFileExtension('/usr/local/file.json')).toBe('json');
    });

    it('extracts extension from files with multiple dots', () => {
      expect(getFileExtension('file.test.ts')).toBe('ts');
      expect(getFileExtension('components.config.js')).toBe('js');
    });

    it('returns empty string for files without extension', () => {
      expect(getFileExtension('Dockerfile')).toBe('');
      expect(getFileExtension('README')).toBe('');
    });

    it('is case-insensitive (returns lowercase)', () => {
      expect(getFileExtension('App.JS')).toBe('js');
      expect(getFileExtension('FILE.TS')).toBe('ts');
    });

    it('handles edge cases', () => {
      expect(getFileExtension('.')).toBe('');
      expect(getFileExtension('..')).toBe('');
      expect(getFileExtension('.gitignore')).toBe('gitignore');
    });
  });
});
