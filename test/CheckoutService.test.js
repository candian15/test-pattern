import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

/**
 * Test doubles usados nesta suíte (terminologia de Meszaros / Fowler):
 *  - Dummy: objeto vazio `{}`, só preenche o parâmetro do construtor e
 *           NÃO deve ser chamado (se for, o teste quebra com TypeError);
 *  - Stub:  devolve respostas pré-definidas para controlar o fluxo; o teste
 *           verifica o ESTADO (valor retornado);
 *  - Mock:  jest.fn() cujas chamadas são verificadas; o teste verifica o
 *           COMPORTAMENTO (interações: quantas vezes e com quais argumentos).
 */

const CARTAO_CREDITO = '4111-1111-1111-1111';

// Stub de repositório que "persiste" devolvendo o pedido recebido com um id,
// para que o teste possa verificar o estado real produzido pelo serviço.
const criarRepositoryStub = (idGerado = 'PED-100') => ({
  salvar: jest.fn().mockImplementation(async (pedido) =>
    new Pedido(idGerado, pedido.carrinho, pedido.totalFinal, pedido.status)),
});

describe('CheckoutService', () => {
  describe('quando o pagamento falha', () => {
    it('deve retornar null (verificação de estado com Stub)', async () => {
      // Arrange
      const carrinho = new CarrinhoBuilder().build();
      const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
      const repositoryDummy = {};
      const emailDummy = {};
      const checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);

      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(pedido).toBeNull();
    });

    it('não deve salvar o pedido nem enviar e-mail (verificação de comportamento com Mocks)', async () => {
      // Arrange
      const carrinho = new CarrinhoBuilder().build();
      const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
      const repositoryMock = { salvar: jest.fn() };
      const emailMock = { enviarEmail: jest.fn() };
      const checkoutService = new CheckoutService(gatewayStub, repositoryMock, emailMock);

      // Act
      await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(repositoryMock.salvar).not.toHaveBeenCalled();
      expect(emailMock.enviarEmail).not.toHaveBeenCalled();
    });
  });

  describe('quando um cliente padrão finaliza a compra', () => {
    let carrinho;
    let gatewayStub;
    let checkoutService;

    beforeEach(() => {
      carrinho = new CarrinhoBuilder()
        .comUser(UserMother.umUsuarioPadrao())
        .comItens([new Item('Teclado', 120)])
        .comItem('Mouse', 80) // total: R$ 200,00
        .build();
      gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
      const emailStub = { enviarEmail: jest.fn().mockResolvedValue() };
      checkoutService = new CheckoutService(gatewayStub, criarRepositoryStub(), emailStub);
    });

    it('deve retornar o pedido salvo com o total sem desconto', async () => {
      // Arrange (carrinho padrão de R$ 200,00 preparado no beforeEach)

      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(pedido.totalFinal).toBe(200);
      expect(pedido.status).toBe('PROCESSADO');
    });

    it('deve cobrar o valor integral, sem desconto', async () => {
      // Arrange (carrinho padrão de R$ 200,00 preparado no beforeEach)

      // Act
      await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(gatewayStub.cobrar).toHaveBeenCalledWith(200, CARTAO_CREDITO);
    });
  });

  describe('quando um cliente Premium finaliza a compra', () => {
    let carrinho;
    let pedidoSalvo;
    let gatewayStub;
    let repositoryStub;
    let emailMock;
    let checkoutService;

    beforeEach(() => {
      carrinho = new CarrinhoBuilder()
        .comUser(UserMother.umUsuarioPremium())
        .comItens([new Item('Teclado', 120), new Item('Mouse', 80)]) // R$ 200,00
        .build();
      pedidoSalvo = new Pedido('PED-123', carrinho, 180, 'PROCESSADO');

      gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
      repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
      emailMock = { enviarEmail: jest.fn().mockResolvedValue() };

      checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);
    });

    it('deve cobrar R$ 180,00, aplicando 10% de desconto', async () => {
      // Arrange (carrinho Premium de R$ 200,00 preparado no beforeEach)

      // Act
      await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, CARTAO_CREDITO);
    });

    it('deve enviar exatamente 1 e-mail de aprovação ao cliente', async () => {
      // Arrange (e-mail Premium: premium@email.com, definido no UserMother)

      // Act
      await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
      expect(emailMock.enviarEmail).toHaveBeenCalledWith(
        'premium@email.com',
        'Seu Pedido foi Aprovado!',
        expect.stringMatching(/PED-123.*R\$180/),
      );
    });

    it('deve retornar o pedido salvo pelo repositório', async () => {
      // Arrange (repositoryStub devolve o pedidoSalvo no beforeEach)

      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(pedido).toBe(pedidoSalvo);
    });

    it('não deve falhar o checkout quando o envio do e-mail falha', async () => {
      // Arrange
      emailMock.enviarEmail.mockRejectedValue(new Error('SMTP indisponível'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO_CREDITO);

      // Assert
      expect(pedido).toBe(pedidoSalvo);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });
  });
});
