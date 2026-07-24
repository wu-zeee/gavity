import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from '../../server/utils/password';

describe('Cloudflare 兼容密码哈希', () => {
  test('PBKDF2 密码可以验证且错误密码被拒绝', async () => {
    const hash = await hashPassword('Stage3-local-pass-123');
    expect(hash).toStartWith('$pbkdf2-sha256$310000$');
    expect(await verifyPassword({ hash, password: 'Stage3-local-pass-123' })).toBe(true);
    expect(await verifyPassword({ hash, password: 'wrong-password' })).toBe(false);
  });
});
