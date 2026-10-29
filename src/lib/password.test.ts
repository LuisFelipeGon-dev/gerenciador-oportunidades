import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordAuthError, validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("accepts a long enough password typed twice the same", () => {
    expect(validateNewPassword("cuiaba2026", "cuiaba2026")).toBeNull();
  });

  it("asks for at least the minimum length", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validateNewPassword("curta12", "curta12")).toBe("Use pelo menos 8 caracteres.");
  });

  it("asks for the same password in both fields", () => {
    expect(validateNewPassword("cuiaba2026", "cuiaba2027")).toBe("As duas senhas não são iguais.");
  });

  it("does not accept only spaces", () => {
    expect(validateNewPassword("        ", "        ")).toBe("Use pelo menos 8 caracteres.");
  });
});

describe("passwordAuthError", () => {
  it.each([
    ["Invalid login credentials", "E-mail ou senha incorretos."],
    ["Email not confirmed", "Confirme seu e-mail pelo link que enviamos antes de entrar."],
    ["User already registered", "Já existe uma conta com esse e-mail. Entre com a senha ou pelo código."],
    ["Password should be at least 6 characters.", "Use pelo menos 8 caracteres."],
    ["For security purposes, you can only request this after 30 seconds.", "Muitos pedidos seguidos. Espere alguns minutos e tente de novo."],
    ["New password should be different from the old password.", "A senha nova precisa ser diferente da atual."],
    ["something unexpected", "Não deu certo agora. Tente de novo em instantes."],
  ])("%s", (message, expected) => {
    expect(passwordAuthError(message)).toBe(expected);
  });
});
