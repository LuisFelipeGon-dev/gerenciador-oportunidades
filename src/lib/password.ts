// Login with a password (besides the e-mail code): the rules for a new password and the
// Supabase Auth messages in Portuguese.

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.trim().length < MIN_PASSWORD_LENGTH) return `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password !== confirm) return "As duas senhas não são iguais.";
  return null;
}

export function passwordAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered|already exists/i.test(message)) return "Já existe uma conta com esse e-mail. Entre com a senha ou pelo código.";
  if (/should be different/i.test(message)) return "A senha nova precisa ser diferente da atual.";
  if (/password should be at least|weak password/i.test(message)) return `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (/rate limit|too many|security purposes|seconds/i.test(message)) return "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.";
  return "Não deu certo agora. Tente de novo em instantes.";
}
