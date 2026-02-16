const GatewayCommunicationHandler = require("../handlers/gateway-handler");
const { createAuthFrame } = require("../utils/gateway-authframe-builder");

class GatewayService {
  constructor() {
    this.gatewayHandler = null;
    this.authCallback = null;
  }

  /**
   * Autentica o gateway. Reusa conexão se já estiver estabelecida.
   * @param {string} ip - Endereço IP do gateway.
   * @param {number} port - Porta TCP do gateway.
   * @param {string} password - Senha para autenticação.
   * @param {function} callback - Callback para processamento de resultado.
   */
  async authenticateGateway(ip, port, password, callback) {
    if (
      !this.gatewayHandler ||
      this.gatewayHandler.ip !== ip ||
      this.gatewayHandler.port !== port
    ) {
      if (this.gatewayHandler) {
        await this.gatewayHandler.close();
      }
      this.gatewayHandler = new GatewayCommunicationHandler(
        ip,
        port,
        this.processResponse.bind(this)
      );
    }

    try {
      if (!this.gatewayHandler.tcpManager.isConnected) {
        await this.gatewayHandler.connect();
      }

      this.authCallback = callback;
      const authFrame = createAuthFrame(password);
      await this.gatewayHandler.sendData(authFrame);
    } catch (error) {
      callback({ fail: true, error: error.message });
    }
  }
  /**
   * Envia dados para o gateway.
   * @param {Buffer|string} data - Dados a serem enviados.
   */
  async sendData(data) {
    try {
      await this.gatewayHandler.sendData(data);
    } catch (error) {
      console.error("Erro ao enviar dados:", error.message);
      throw error;
    }
  }

  /**
   * Processa a resposta recebida do Gateway.
   * @param {Buffer} data - Dados recebidos.
   */
  processResponse(data) {
    this.gatewayHandler.handleResponse(data, this.authCallback);
  }

  /**
   * Processa um evento genérico do Gateway e retorna o objeto correspondente.
   * @param {Buffer} data - Dados recebidos do Gateway.
   * @param {string} event - Nome do evento a ser registrado no objeto retornado.
   * @returns {Object} Objeto contendo o evento e o status de sucesso.
   */
  handleGatewayEvent(data, event) {
    const obj = {
      event,
      data: { success: data[1] === 0 },
    };
    return { obj };
  }
}

module.exports = new GatewayService();
