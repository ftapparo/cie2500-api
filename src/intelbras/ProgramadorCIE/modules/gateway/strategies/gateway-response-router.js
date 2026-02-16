const {
  AuthenticationResponseHandler,
  PingResponseHandler,
  DefaultResponseHandler,
} = require("./gateway-response-strategies");
const gatewayMediator = require("../mediators/gateway-mediator");
const config = require("../../../routes/config")();

const strategies = {
  [config.CIE_commands.SET_GATEWAY_AUTH_ETH]:
    new AuthenticationResponseHandler(),
  [config.CIE_commands.PING]: new PingResponseHandler(),
};

class GatewayResponseRouter {
  constructor() {
    this.mediator = gatewayMediator;
    this.defaultHandler = new DefaultResponseHandler();
  }

  execute(data, callback) {
    const commandCode = data[0];
    const handler = strategies[commandCode] || this.defaultHandler;
    this.mediator.handleResponse(handler, data, callback);
  }
}

module.exports = GatewayResponseRouter;
