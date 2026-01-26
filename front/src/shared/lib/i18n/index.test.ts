import { describe, it, expect } from 'vitest';
import i18n from './index';

describe('i18n', () => {
  it('한국어가 기본 언어로 설정되어 있다', () => {
    expect(i18n.language).toBe('ko');
  });

  it('번역 키로 한국어 텍스트를 가져올 수 있다', () => {
    const text = i18n.t('common.loading');
    expect(text).toBe('로딩 중...');
  });

  it('영어로 언어를 변경할 수 있다', async () => {
    await i18n.changeLanguage('en');
    const text = i18n.t('common.loading');
    expect(text).toBe('Loading...');
    await i18n.changeLanguage('ko'); // 원복
  });
});
