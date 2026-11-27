import { SecretBox } from './secret-box';

describe('SecretBox', () => {
  it('criptografa e lê de volta; o texto guardado não contém a senha', () => {
    const box = new SecretBox('chave-de-teste-123456');
    const enc = box.encrypt('minha-senha-smtp');
    expect(enc).not.toContain('minha-senha-smtp');
    expect(box.decrypt(enc)).toBe('minha-senha-smtp');
  });

  it('cada criptografia é diferente (IV aleatório)', () => {
    const box = new SecretBox('chave-de-teste-123456');
    expect(box.encrypt('x')).not.toBe(box.encrypt('x'));
  });

  it('com outra chave não decifra (retorna null)', () => {
    const enc = new SecretBox('chave-A-1234567890').encrypt('segredo');
    expect(new SecretBox('chave-B-1234567890').decrypt(enc)).toBeNull();
  });
});
