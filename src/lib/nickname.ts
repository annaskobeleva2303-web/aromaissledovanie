import { z } from "zod";

export const nicknameRegex = /^[а-яА-ЯёЁa-zA-Z0-9_ ]+$/;

const legacyNicknameRegex = /^[a-z0-9_]+$/;

export const normalizeNickname = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ");

const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const toCanonicalNickname = (value: string) =>
  normalizeNickname(value).toLocaleLowerCase("ru-RU");

export const createAuthEmailFromNickname = (nickname: string) => {
  const canonicalNickname = toCanonicalNickname(nickname);

  if (legacyNicknameRegex.test(canonicalNickname)) {
    return `${canonicalNickname}@anonymous.local`;
  }

  return `${toBase64Url(canonicalNickname)}@anonymous.local`;
};

export const getSignInEmailsForNickname = (nickname: string) => {
  const canonicalNickname = toCanonicalNickname(nickname);
  const encodedEmail = `${toBase64Url(canonicalNickname)}@anonymous.local`;

  if (legacyNicknameRegex.test(canonicalNickname)) {
    return Array.from(new Set([`${canonicalNickname}@anonymous.local`, encodedEmail]));
  }

  return [encodedEmail];
};

export const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Минимум 3 символа")
  .max(24, "Максимум 24 символа")
  .regex(nicknameRegex, "Разрешены русские и латинские буквы, цифры, пробелы и _")
  .transform(normalizeNickname);