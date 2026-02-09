/**
 * Criado por Livecom on 12/10/2018.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

var CONFIG = require("./udpConfig");
var config = require("./config")();
var UdpUtils = require("./udpUtils");
var CIE_commands = config.CIE_commands;
var udp;

var RemoteConnection = {
  ip: undefined,
  token: undefined,
  stopCommunication: function () {
    try {
      var this_ = RemoteConnection;
      this_.token = undefined;
      this_.ip = undefined;
      this_.control = {};
      this_.clearTimeoutConnection();
      udp.wsSendFunction({ event: "disconnected" });
    } catch (e) {
      console.log(e);
    }
  },
  startConnection: function (params) {
    var this_ = RemoteConnection;
    this_.ip = params.ip;
    this_.token = params.token;

    udp.remoteOpperationStopFn = this_.stopCommunication;

    udp.setReceiverRemoteConnectionFn(function (data) {
      if (data.length) {
        console.log("<< UDP RECEIVED", new Uint8Array(data.slice(5, 6)));
        if (!this_.interceptor(data)) {
          udp.communicationHandler(UdpUtils.extractMessageData(data));
        }
      }
    });

    var COMANDO = new Uint8Array([1]);
    this_.send(COMANDO);
    setTimeout(function () {
      this_.verifyCommunication();
    }, 2000);
  },
  bufferIdentify: undefined,
  timeoutSend: undefined,
  send: function (data) {
    var _this = RemoteConnection;
    try {
      if (!_this.token) {
        return;
      }

      var command = UdpUtils.concatenateBuffer(
        new Uint8Array([
          CONFIG.COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_CONFIGURACAO_REMOTA,
        ]),
        new Buffer.from(_this.token)
      );

      _this.bufferIdentify = UdpUtils.generateMessageIdentify();
      command = UdpUtils.concatenateBuffer(command, _this.bufferIdentify);
      command = UdpUtils.concatenateBuffer(command, data);

      _this.sendToUdp(command);
    } catch (e) {
      console.log(e);
    }
  },
  sendToUdp: function (command) {
    var _this = RemoteConnection;
    command = command.map(function (i) {
      return i === null ? 0 : i;
    });
    udp.send(command, _this.ip).then(
      function (value) {
        var identify = UdpUtils.extractMessageIndentify(command, "SEND");
        var commandCode = command.slice(9, 10)[0];

        if (!_this.control[identify] && commandCode !== 99) {
          _this.control[identify] = {
            attemps: 0,
            sentTime: new Date().getTime(),
            received: false,
            command,
          };
        }

        console.log(">> UDP SEND", commandCode, "ID=", identify);
      },
      function (reason) {
        console.log(">> UDP ERROR", reason);
      }
    );
  },
  control: {},
  interceptor: function (data) {
    var this_ = RemoteConnection;

    var identify = UdpUtils.extractMessageIndentify(data, "RECEIVED");

    console.log("RECEIVED ID=", identify);

    if (this_.control[identify]) {
      if (this_.control[identify].received) {
        console.log("RECEBIDO NOVAMENTE ID=", identify);
        return true;
      }
      this_.control[identify].received = true;
    }

    return false;
  },
  verifyCommunication: function () {
    var _this = RemoteConnection;

    _this.timeoutConnection = setInterval(function () {
      try {
        if (!_this.control) return;

        for (var identify in _this.control) {
          let command;
          var now = new Date().getTime();
          var message = _this.control[identify];

          if (message.command) {
            command = message.command.slice(9, 10);
          }

          if (message.received) {
            if (now - message.sentTime > 20000) {
              delete _this.control[identify];
            }
          } else if (message.attemps <= 20) {
            console.log("PEDE NOVAMENTE COMANDO", command, "ID", identify);
            message.attemps++;
            _this.sendToUdp(message.command);
          } else {
            console.log("NÃO RECEBIDO", command, "ID=", identify);
            udp.stopCommunication();
          }
        }
      } catch (e) {
        console.log("ERROR verifyCommunication", e);
      }
    }, CONFIG.TIMEOUT.RESEND_MESSAGE_REMOTE_CONECTION);
  },
  clearTimeoutConnection: function () {
    var this_ = RemoteConnection;
    console.log("#@@@ clearTimeoutConnection");
    if (this_.timeoutConnection) {
      console.log("CLEAR");
      clearTimeout(this_.timeoutConnection);
      this_.timeoutConnection = undefined;
    }
  },
  timeoutConnection: undefined,
};

module.exports = function (udpModule) {
  udpModule.sendFn = RemoteConnection.send;

  udp = udpModule;
  return RemoteConnection;
};
