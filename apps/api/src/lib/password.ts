import argon2 from 'argon2';

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP 2024 min
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, ARGON_OPTS);

export const verifyPassword = (hash: string, plain: string): Promise<boolean> =>
  argon2.verify(hash, plain);
