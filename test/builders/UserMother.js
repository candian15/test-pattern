import { User } from '../../src/domain/User.js';

/**
 * Object Mother de User.
 *
 * Usuários são entidades simples e quase sempre iguais entre os testes
 * (só mudam de "tipo"), então métodos estáticos com nomes de negócio
 * bastam. Os valores são fixos e previsíveis de propósito: os testes
 * podem confiar neles (ex.: o e-mail do Premium).
 */
export class UserMother {
  static umUsuarioPadrao() {
    return new User(1, 'Cliente Padrão', 'padrao@email.com', 'PADRAO');
  }

  static umUsuarioPremium() {
    return new User(2, 'Cliente Premium', 'premium@email.com', 'PREMIUM');
  }
}
