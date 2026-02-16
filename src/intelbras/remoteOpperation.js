/**
 * Criado por Livecom on 12/10/2018.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

var CONFIG = require("./udpConfig");
var parser = require("./udpParser").parser;
var UdpUtils = require("./udpUtils");
var udp;
var COMANDO;

var RemoteOpperation = {
  ipRemoteConnection: undefined,
  timeout: undefined,
  control: {},
  token: undefined,
  stopCommunication: function () {
    var _this = RemoteOpperation;
    try {
      if (_this.timeout) {
        clearInterval(_this.timeout);
        _this.timeout = undefined;
      }
      _this.control = {};
      _this.token = undefined;
      //console.log("LIMPA TOKEN");
    } catch (e) {
      //console.log(e);
    }
  },
  startCommunication: function (params) {
    var this_ = this;
    this_.token = params.token;
    //console.log("SETA TOKEN", params.token);

    udp.remoteOpperationStopFn = this_.stopCommunication;

    udp.setReceiverRemoteOpperationFn(function (data) {
      var message = parser(data);

      if (message.event === "none") return;

      if (message.event === "udp_nak") {
        udp.wsSendFunction({
          event: "udp_error",
          data: { error: true },
        });
        udp.stopCommunication();
        return;
      }

      try {
        udp.wsSendFunction({
          event: message.event,
          data: message.data,
        });

        if (
          [
            "udp_evento",
            "udp_log",
            "udp_dispositivo",
            "udp_regra",
            "udp_zona",
            "udp_bloquear",
          ].includes(message.event)
        ) {
          message.event = message.event + "#" + message.data.numero;
        }

        this_.control[message.event].received = true;
        this_.control[message.event].times = 0;

        //console.log("RECEIVED", message.event);
      } catch (e) {
        //console.log("ERROR RECEIVED", message.event);
      }
    });

    udp.wsSendFunction({
      event: "udp_start_communication",
    });

    setTimeout(function () {
      this_.verifyCommunication();
    }, 2000);
  },
  verifyCommunication: function () {
    var _this = this;

    _this.timeout = setInterval(function () {
      if (!_this.control) return;

      for (var event in _this.control) {
        var message = _this.control[event];
        if (message.received) {
          //console.log("RECEIVED EVENT", event);
          delete _this.control[event];
        } else if (message.times <= 20) {
          message.times++;
          //console.log("GET EVENT", event, "times=" + message.times);
          getFromCentral(event, message.ip, message.data, message.withoutAuth);
        } else {
          udp.wsSendFunction({
            event: event,
            data: { error: true },
          });
          delete _this.control[event];
        }
      }
    }, CONFIG.TIMEOUT.RESEND_MESSAGE_REMOTE_OPPERATION);

    if (_this.timeout && typeof _this.timeout.unref === 'function') {
      _this.timeout.unref();
    }
  },
  getEvent: function (params) {
    var tipoEvento = {
      alarme: 0,
      falha: 1,
      supervisao: 2,
      bloqueio: 3,
    };
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_EVENTOS_INDIVIDUAL_INTERLIGACAO_CENTRAL,
      [params.endereco, tipoEvento[params.evento], params.numero]
    );
    getFromCentral("udp_evento#" + params.numero, params.ip, COMANDO);
  },
  getLog: function (params) {
    var tipoEvento = {
      alarme: 0,
      falha: 1,
      supervisao: 2,
      operacao: 3,
    };
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_REGISTROS_INTERLIGACAO_CENTRAL,
      [params.endereco, tipoEvento[params.evento], params.numero]
    );
    getFromCentral("udp_log#" + params.numero, params.ip, COMANDO);
  },
  getRule: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_REGRAS_INTERLIGACAO_CENTRAL,
      [params.endereco, params.tipoCarrega, params.numero]
    );
    getFromCentral("udp_regra#" + params.numero, params.ip, COMANDO);
  },
  getDateTime: function (params) {
    COMANDO = new Uint8Array([
      CONFIG.COMANDO.COMANDO_SOLICITA_DATA_HORA_INTERLIGACAO_CENTRAL,
    ]);
    getFromCentral("udp_data_hora", params.ip, COMANDO);
  },
  getRuleAll: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_REGRAS_INTERLIGACAO_CENTRAL,
      [params.endereco, params.tipoCarrega, params.numero]
    );
    getFromCentral("udp_regra_todos", params.ip, COMANDO);
  },
  getZone: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_ZONAS_INTERLIGACAO_CENTRAL,
      [params.endereco, params.tipoCarrega, params.numero]
    );
    getFromCentral("udp_zona#" + params.numero, params.ip, COMANDO);
  },
  getZoneAll: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_ZONAS_INTERLIGACAO_CENTRAL,
      [params.endereco, params.tipoCarrega, params.numero]
    );
    getFromCentral("udp_zona_todos", params.ip, COMANDO);
  },
  getDevice: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_DISPOSITIVOS_INTERLIGACAO_CENTRAL,
      [params.endereco, params.tipoCarrega, params.laco, params.numero]
    );
    getFromCentral("udp_dispositivo#" + params.numero, params.ip, COMANDO);
  },
  getDeviceAll: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_DISPOSITIVOS_INTERLIGACAO_CENTRAL,
      [params.endereco, params.tipoCarrega, params.laco, params.numero]
    );
    getFromCentral("udp_dispositivo_todos", params.ip, COMANDO);
  },
  getStatus: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_STATUS_CENTRAIS_INTERLIGACAO,
      [params.endereco]
    );
    getFromCentral("udp_status", params.ip, COMANDO);
  },
  getInfo: function (params) {
    COMANDO = new Uint8Array([
      CONFIG.COMANDO.COMANDO_SOLICITA_INFORMACOES_CENTRAL_INTERLIGACAO_CENTRAL,
      params.endereco,
    ]);
    getFromCentral("udp_info", params.ip, COMANDO);
  },
  getMac: function (params) {
    COMANDO = new Uint8Array([
      CONFIG.COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_SOLICITA_MAC_ADDRESS,
    ]);
    getFromCentral("udp_mac", params.ip, COMANDO, true);
  },
  getNameModel: function (params) {
    COMANDO = new Uint8Array([
      CONFIG.COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_SOLICITA_NOME_MODELO,
    ]);
    getFromCentral("udp_nome_e_modelo", params.ip, COMANDO, true);
  },
  getLoops: function (params) {
    COMANDO = new Uint8Array([
      CONFIG.COMANDO.COMANDO_SOLICITA_LACOS_INTERLIGACAO_CENTRAL,
    ]);
    getFromCentral("udp_laco", params.ip, COMANDO);
  },
  getCRCTimingRule: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_SOLICITA_CRC_REGRAS_INTERLIGACAO_CENTRAL,
      [params.endereco]
    );
    getFromCentral("udp_crc_regras_temporizando", params.ip, COMANDO);
  },
  changeBlockDevice: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_ENVIAR_COMANDOS_BLOQUEIOS_INTERLIGACAO_CENTRAL,
      [
        params.tipoBloqueio,
        params.laco,
        params.numero,
        params.bloquear,
        0,
        params.identificador,
      ]
    );
    getFromCentral("udp_bloquear#" + params.numero, params.ip, COMANDO);
  },
  changeOutputDevice: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_ENVIAR_COMANDOS_SAIDAS_INTERLIGACAO_CENTRAL,
      [params.laco, params.numero, params.ativo, 0, params.identificador]
    );
    getFromCentral("udp_ativar_saida", params.ip, COMANDO);
  },
  sendButtonCommand: function (params) {
    COMANDO = UdpUtils.genericMessage(
      CONFIG.COMANDO.COMANDO_ENVIAR_COMANDOS_INTERLIGACAO_CENTRAL,
      [params.endereco, params.botao, params.parametro, 0, params.identificador]
    );
    getFromCentral("udp_enviar_comando", params.ip, COMANDO);
  },
  getBlocksCounters: function (params) {
    COMANDO = new Uint8Array([
      CONFIG.COMANDO.COMANDO_SOLICITA_CONTADORES_BLOQUEIOS_INTERLIGACAO_CENTRAL,
      params.endereco,
    ]);
    getFromCentral("udp_bloqueios_contadores", params.ip, COMANDO);
  },
  getOutputsCounters: function (params) {
    COMANDO = new Uint8Array([
      CONFIG.COMANDO.COMANDO_SOLICITA_CONTADORES_SAIDAS_INTERLIGACAO_CENTRAL,
      params.endereco,
    ]);
    getFromCentral("udp_saidas_contadores", params.ip, COMANDO);
  },
  forceStopCommunication: function (params) {
    udp.stopCommunication();
  },
};

function getFromCentral(event, ip, data, withoutAuth) {
  try {
    var command = data;

    if (!withoutAuth) {
      command = UdpUtils.makeCommandWithAuth(data, RemoteOpperation.token);
    }

    //console.log("SEND", event, command);

    udp.send(command, ip).then(
      function (value) {
        if (!RemoteOpperation.control[event]) {
          RemoteOpperation.control[event] = {
            received: false,
            times: 0,
            ip: ip,
            data: data,
            withoutAuth: withoutAuth,
          };
        } else {
          RemoteOpperation.control[event].received = false;
        }
      },
      function (reason) {
        //console.log("UDP SEND ERROR", reason);
        if (reason.code === "ENETUNREACH") {
          udp.wsSendFunction({
            event: "udp_error",
            data: { error: true },
          });
          udp.stopCommunication();
        }
      }
    );
  } catch (e) {
    //console.log(e);
    return null;
  }
}

module.exports = function (udpModule) {
  udp = udpModule;
  return RemoteOpperation;
};
