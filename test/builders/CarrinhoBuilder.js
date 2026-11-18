import { Carrinho } from '../../src/domain/Carrinho.js';
import { Item } from '../../src/domain/Item.js';
import { UserMother } from './UserMother.js';

/**
 * Data Builder de Carrinho.
 *
 * Um Carrinho varia em várias dimensões (usuário, quantidade e valor dos
 * itens, vazio). Um "CarrinhoMother" precisaria de um método para cada
 * combinação; o Builder parte de um carrinho válido padrão (usuário padrão
 * com 1 item de R$ 100,00) e cada teste altera apenas o que importa para
 * o seu cenário, de forma fluente:
 *
 *   new CarrinhoBuilder().comUser(premium).comItens([...]).build();
 */
export class CarrinhoBuilder {
  constructor() {
    this.user = UserMother.umUsuarioPadrao();
    this.itens = [new Item('Item Padrão', 100)];
  }

  comUser(user) {
    this.user = user;
    return this;
  }

  comItens(itens) {
    this.itens = [...itens];
    return this;
  }

  comItem(nome, preco) {
    this.itens = [...this.itens, new Item(nome, preco)];
    return this;
  }

  vazio() {
    this.itens = [];
    return this;
  }

  build() {
    return new Carrinho(this.user, this.itens);
  }
}
