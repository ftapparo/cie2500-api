const Controller = require("../../../routes/CIE_USB");

class GatewayMediator {
  constructor(controller = Controller) {
    this.controller = controller;
    this.tcpManager = null;
  }

  setTcpManager(tcpManager) {
    this.tcpManager = tcpManager;
  }

  updateControllerStatus(status, deviceModel = "GATEWAY") {
    this.controller.setConnectionStatus(status, deviceModel);
  }

  handleResponse(handler, data, callback) {
    handler.execute(this.controller, data, this.tcpManager, callback);
  }
}

module.exports = new GatewayMediator();
