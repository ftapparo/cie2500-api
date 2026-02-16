const TCPCommunicationManager = require("../../../communication/tcp/communication-manager");
const gatewayMediator = require("../mediators/gateway-mediator");
const GatewayResponseRouter = require("../strategies/gateway-response-router");

class GatewayCommunicationHandler {
  constructor(ip, port, onDataCallback) {
    this.ip = ip;
    this.port = port;
    this.tcpManager = new TCPCommunicationManager(
      this.ip,
      this.port,
      onDataCallback
    );
    this.responseRouter = new GatewayResponseRouter();
    gatewayMediator.setTcpManager(this.tcpManager);
  }

  async connect() {
    await this.tcpManager.connect();
  }

  async sendData(data) {
    await this.tcpManager.send(data);
  }

  async close() {
    await this.tcpManager.close();
  }

  handleResponse(data, callback) {
    try {
      this.responseRouter.execute(data, callback);
    } catch (error) {
      throw new Error(`Erro ao processar resposta: ${error.message}`);
    }
  }
}

module.exports = GatewayCommunicationHandler;
