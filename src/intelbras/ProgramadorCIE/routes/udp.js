/**
 * Criado por Livecom on 12/10/2018.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

var CONFIG = require("./udpConfig");
var parser = require("./udpParser").parser;
var UdpUtils = require("./udpUtils");
var centrais = {};

var udp = {
  socketRemoteConnection: undefined,
  socketRemoteOpperation: undefined,
  socketMulticast: undefined,
  bootstrap: async function () {
    try {
      var this_ = this;

      return new Promise(async (resolve) => {
        var adapters = UdpUtils.getLocalIp();

        if (this_.socketMulticast) {
          UdpUtils.closeSocket(this_.socketMulticast);
          this_.socketMulticast = undefined;
        }

        if (!this_.socketMulticast) {
          this_.socketMulticast = await UdpUtils.createSocket();
          this_.socketMulticast.on("message", this_.receiverMulticastFn);
          this_.socketMulticast.on("listening", function () {
            this_.socketMulticast.setMulticastTTL(128);
            for (var ip of adapters) {
              this_.socketMulticast.addMembership(CONFIG.IPV4_GROUP, ip);
            }
            //console.log("OPEN socketRemoteOpperation");
          });
          this_.socketMulticast.on("close", function () {
            //console.log("CLOSE socketMulticast");
            UdpUtils.closeSocket(this_.socketMulticast);
          });
          this_.socketMulticast.on("error", function () {
            //console.log("ERROR socketMulticast");
          });
          this_.socketMulticast.bind(CONFIG.PORT_REMOTE_OPPERATION_MULTICAST);
        }

        if (!this_.socketRemoteOpperation) {
          this_.socketRemoteOpperation = await UdpUtils.createSocket(
            CONFIG.PORT_REMOTE_OPPERATION
          );
          this_.socketRemoteOpperation.on(
            "message",
            this_.receiverRemoteOpperationFn
          );
          this_.socketRemoteOpperation.on("listening", function () {
            //console.log("OPEN socketRemoteOpperation");
          });
          this_.socketRemoteOpperation.on("close", function () {
            //console.log("CLOSE socketRemoteOpperation");
            UdpUtils.closeSocket(this_.socketRemoteOpperation);
          });
          this_.socketRemoteOpperation.on("error", function () {
            //console.log("ERROR socketRemoteOpperation");
          });
        }

        if (!this_.socketRemoteConnection) {
          this_.socketRemoteConnection = await UdpUtils.createSocket(
            CONFIG.PORT_REMOTE_CONNECTION
          );
          this_.socketRemoteConnection.on(
            "message",
            this_.receiverRemoteConnectionFn
          );
          this_.socketRemoteConnection.on("listening", function () {
            //console.log("OPEN socketRemoteConnection");
          });
          this_.socketRemoteConnection.on("close", function () {
            //console.log("CLOSE socketRemoteConnectio");
            UdpUtils.closeSocket(this_.socketRemoteConnection);
          });
          this_.socketRemoteConnection.on("error", function () {
            //console.log("ERROR socketRemoteConnection");
          });
        }

        resolve();
      });
    } catch (e) {
      //console.log(e);
    }
  },
  assign: async function (getNameMac) {
    var this_ = udp;

    try {
      await udp.bootstrap();

      this_.lastCentralsReceived = undefined;

      var attemps = 0;
      await new Promise(async (resolve) => {
        while (attemps <= 5 && !this_.lastCentralsReceived) {
          await UdpUtils.sleep(1000);
          attemps++;
        }
        resolve();
      });

      centrais = this_.lastCentralsReceived;

      if (!centrais) {
        this_.wsSendFunction({ event: "udp_descobrir", data: [] });
        return;
      }

      var timeout, intervalInfo;

      var hasReceivedAllInfo = function () {
        var count = 0;
        for (var central of Object.values(centrais.data)) {
          if (central.mac && central.nome) {
            count++;
          }
        }
        return Object.keys(centrais.data).length === count;
      };

      var getMac = function (central) {
        var COMANDO_MAC = new Uint8Array([
          CONFIG.COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_SOLICITA_MAC_ADDRESS,
        ]);
        if (this_.socketRemoteConnection)
          this_.socketRemoteConnection.send(
            UdpUtils.cypher.crypt(COMANDO_MAC),
            CONFIG.PORT_REMOTE_CONNECTION,
            central.ip
          );
      };

      var getName = function (central) {
        var COMANDO_NOME_E_MODELO = new Uint8Array([
          CONFIG.COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_SOLICITA_NOME_MODELO,
        ]);
        if (this_.socketRemoteConnection)
          this_.socketRemoteConnection.send(
            UdpUtils.cypher.crypt(COMANDO_NOME_E_MODELO),
            CONFIG.PORT_REMOTE_CONNECTION,
            central.ip
          );
      };

      this_.setReceiverAssignFn(function (data, remote) {
        var newAttrs = parser(data).data;
        for (var idxCentral in centrais.data) {
          var central = centrais.data[idxCentral];
          if (central.ip === remote.address) {
            for (var attr in newAttrs) {
              var attrValue = newAttrs[attr];
              //console.log(attr, attrValue);
              central[attr] = attrValue;
            }
          }
        }
        if (hasReceivedAllInfo()) {
          this_.waitingMulticastInfo = false;
          this_.wsSendFunction(centrais);
          clearTimeout(timeout);
          clearInterval(intervalInfo);
        }
      });

      if (getNameMac) {
        intervalInfo = setInterval(function () {
          for (var central of Object.values(centrais.data)) {
            if (!central.mac) {
              getMac(central);
            }
            if (!central.nome) {
              getName(central);
            }
          }
        }, 500);

        timeout = setTimeout(function () {
          //console.log("timeout udp");
          this_.wsSendFunction({
            event: "udp_descobrir",
            data: centrais.data || [],
          });
          this_.waitingMulticastInfo = false;
          clearInterval(intervalInfo);
        }, CONFIG.TIMEOUT.WAIT_MULTICAST_RESPONSE);

        this_.waitingMulticastInfo = true;

        for (var iCentral in centrais.data) {
          var central = centrais.data[iCentral];
          getMac(central);
          getName(central);
        }
      } else {
        this_.wsSendFunction({
          event: "udp_descobrir",
          data: centrais.data || [],
        });
      }
    } catch (e) {
      //console.log("assign ERROR", e);
      this_.wsSendFunction({
        event: "udp_descobrir",
        data: [],
      });
    }
  },
  auth: async function (params) {
    try {
      var ip = params.ip;
      var this_ = udp;
      await udp.bootstrap();
      this_.waitingForAuth = true;

      function tryAuth() {
        var COMANDO_AUTENTICACAO = UdpUtils.concatenateBuffer(
          new Uint8Array([
            CONFIG.COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_AUTENTICACAO_REMOTA,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ]),
          UdpUtils.concatenateBuffer(
            new Buffer.from(params.password),
            new Uint8Array(6 - params.password.length)
          )
        );
        COMANDO_AUTENTICACAO = UdpUtils.cypher.crypt(COMANDO_AUTENTICACAO);
        this_.socketRemoteConnection.send(
          COMANDO_AUTENTICACAO,
          CONFIG.PORT_REMOTE_CONNECTION,
          ip,
          async function (err) {
            if (err) {
              this_.wsSendFunction({
                event: "udp_autenticacao",
                data: { network_error: true },
              });
              this_.stopCommunication();
              this_.waitingForAuth = false;
            }
          }
        );
      }

      tryAuth();

      var attemps = 0;
      await new Promise(async (resolve) => {
        while (attemps <= 15 && this_.waitingForAuth) {
          await UdpUtils.sleep(500);
          if (this_.waitingForAuth) {
            tryAuth();
          }
          attemps++;
        }
        resolve();
      });
    } catch (e) {
      this_.stopCommunication();
      this_.waitingForAuth = false;
    }
  },
  send: function (data, ip) {
    var this_ = this;
    return new Promise(function (accept, reject) {
      if (this_.socketRemoteOpperation) {
        data = UdpUtils.cypher.crypt(data);
        this_.socketRemoteConnection.send(
          data,
          CONFIG.PORT_REMOTE_CONNECTION,
          ip,
          function (err) {
            if (err) {
              reject(err);
            } else {
              accept();
            }
          }
        );
      } else {
        reject();
      }
    });
  },
  lastCentralsReceived: undefined,
  receiverMulticastFn: async function (message, remote) {
    message = UdpUtils.cypher.decrypt(message);

    if (message.error) {
      //console.log("ERROR", message.error);
    }

    if (message.error && message.error !== CONFIG.ERRORS.FAIL_COUNTER) {
      return;
    }

    message = parser(message.data);

    if (message.event === "udp_descobrir") {
      udp.lastCentralsReceived = message;
      if (!udp.waitingForAuth /*&& !udp.hasConnection()*/) {
        UdpUtils.cypher.setCounters(message.counterSend, message.counterRecv);
      }
    } else {
      UdpUtils.cypher.setCounters(message.counterSend, message.counterRecv);
    }
  },
  receiverAssign: undefined,
  receiverAssignFn: function (data, remote) {
    udp.receiverAssign(data, remote);
  },
  setReceiverAssignFn: function (fn) {
    udp.receiverAssign = fn;
  },
  receiverRemoteOpperation: undefined,
  receiverRemoteOpperationFn: function (data) {
    var message = UdpUtils.cypher.decrypt(data);

    if (message.error) {
      return;
    }

    if (udp.receiverRemoteOpperation)
      udp.receiverRemoteOpperation(message.data);
  },
  setReceiverRemoteOpperationFn: function (fn) {
    udp.receiverRemoteOpperation = fn;
  },
  receiverRemoteConnection: undefined,
  setIsConfigurationUpdating: (value) => {
    udp.isConfigurationUpdating = value;
  },
  isConfigurationUpdating: false,
  receiverRemoteConnectionFn: function (data, remote) {
    var message = UdpUtils.cypher.decrypt(data);

    if (
      message.error &&
      !(
        message.error === CONFIG.ERRORS.FAIL_COUNTER &&
        udp.isConfigurationUpdating
      )
    ) {
      return;
    }

    data = message.data;

    var this_ = udp;

    if (udp.receiverRemoteConnection) {
      udp.receiverRemoteConnection(data);
    }

    if (udp.waitingMulticastInfo) {
      udp.receiverAssignFn(data, remote);
    }

    if (udp.waitingForAuth) {
      var message = parser(data);
      if (message.event === "none" || message.event === "udp_nak") return;
      this_.wsSendFunction({
        event: message.event,
        data: message.data,
      });
      if (message.event === "udp_autenticacao" && message.data.token) {
        this_.setConnectionStatus(true);
      }
      udp.waitingForAuth = false;
    }

    if (udp.receiverRemoteOpperation) {
      udp.receiverRemoteOpperation(data);
    }
  },
  setReceiverRemoteConnectionFn: function (fn) {
    udp.receiverRemoteConnection = fn;
  },
  stopCommunication: function () {
    var this_ = udp;
    try {
      if (this_.socketRemoteOpperation) {
        UdpUtils.closeSocket(this_.socketRemoteOpperation);
        this_.socketRemoteOpperation = undefined;
      }
      if (this_.socketRemoteConnection) {
        UdpUtils.closeSocket(this_.socketRemoteConnection);
        this_.socketRemoteConnection = undefined;
      }
      if (this_.remoteOpperationStopFn) {
        this_.remoteOpperationStopFn();
        this_.remoteOpperationStopFn = undefined;
      }
      if (this_.receiverRemoteOpperation) {
        this_.receiverRemoteOpperation = undefined;
      }
      if (this_.receiverRemoteConnection) {
        this_.receiverRemoteConnection = undefined;
      }
      //console.log("setConnectionStatus 2");

      this_.setConnectionStatus(false);
    } catch (e) {
      //console.log(e);
    }
  },
  remoteOpperationStopFn: undefined,
  communicationHandler: undefined,
  sendFn: undefined,
};

module.exports = function (wsSendFunction) {
  udp.wsSendFunction = wsSendFunction;
  return udp;
};
