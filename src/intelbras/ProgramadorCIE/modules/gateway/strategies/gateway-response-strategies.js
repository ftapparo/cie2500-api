const config = require("../../../routes/config")();

class CommandResponseHandler {
  execute(controller, data, tcpManager, callback) {
    throw new Error("execute() must be implemented");
  }
}

class AuthenticationResponseHandler extends CommandResponseHandler {
  execute(_, data, tcpManager, callback) {
    const blockTime =
      (data[3] | (data[4] << 8) | (data[5] << 16) | (data[6] << 24)) / 1000;

    const result = {
      fail: data[1] === 1,
      remainingAttempts: data[2],
      remainingBlockTime: parseInt(blockTime, 10),
    };

    if (!result.fail) {
      tcpManager.send(Buffer.from([1]));
    }

    callback(result);
  }
}

class PingResponseHandler extends CommandResponseHandler {
  execute(controller, data, tcpManager, callback) {
    controller.setIsConfigurationUpdating(false);
    if (!controller.commandReceived) {
      callback({
        event: "timeout_config",
        command: { data },
      });
    }

    controller.commandReceived = true;
    new DefaultResponseHandler().execute(controller, data, tcpManager);
  }
}

class DefaultResponseHandler extends CommandResponseHandler {
  execute(controller, data, tcpManager) {
    const deviceModel = "GATEWAY";
    controller.setConnectionStatus(true, deviceModel);
    controller.sendTCPFn = tcpManager.send.bind(tcpManager);
    controller.CommunicationHandler(
      data,
      config.connectionsMode.NETWORK,
      tcpManager
    );
  }
}

module.exports = {
  AuthenticationResponseHandler,
  PingResponseHandler,
  DefaultResponseHandler,
};
