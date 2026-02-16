/**
 * Criado por Livecom on 3/19/2016.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

const HID = require("node-hid"); //modulo para comunicacao com central
const fs = require("fs");
const parseConfig = require("./parseConfig");
const CRCUtils = require("./crcUtils");
const config = require("./config")();
const CIE_commands = config.CIE_commands;
const net = require("net");
let client;
let connectionLock = Promise.resolve();

let CIEModel;
let blockedConnection = false;
let blockedConnectionTimeout = undefined;
let dumpFile = undefined;
let checkFirmareTimeout = undefined;
let loopScanTimeout = undefined;
let loopScanReceived = undefined;
let gatewayLogGetting = false;
let loopScan = [
  { dispositivos: {} },
  { dispositivos: {} },
  { dispositivos: {} },
  { dispositivos: {} },
];
let CIEconfig = {
  sistema: {},
  zonas: {},
  regras: {},
  lacos: [
    { dispositivos: {} },
    { dispositivos: {} },
    { dispositivos: {} },
    { dispositivos: {} },
  ],
};

let json_logs = { alarme: [], falha: [], supervisao: [], operacao: [] };

let parsedLoopConfig = [];
let parsedDeviceConfig = [];
let parsedZoneConfig = [];
let parsedRuleConfig = [];
let parsedRuleItemConfig = [];
let parsedSystemConfig = [];
let parsedFirmware = [];
let frameControl = 0;
let lastProgressSent;
let usbInterval = undefined;
let firmwareUpdating = false;
let configurationUpdating = false;
let isCriticalCommand = false;
let developerMode = false;
let USB_HID = undefined;
let networkBoard = false;
let parsedGatewayConfig = [];
let parsedCertificatesFrames = {};
let certificatesControl = {};
let certificatesInfo = {};
let receivedGatewayFrames = [];
let obj = {};

const Controller = {
  CommunicationHandler: function (data, connectionMode, tcpManager, callback) {
    try {
      ////console.log("<< RECEIVED:");
      ////console.log("<< " + Array.from(data).toString());
      //fs.writeFileSync('log.txt', '<< ' + Array.from(data).toString() + '\n', {flag: 'a'});

      switch (data[0]) {
        //se central está conectada e comunicando
        case CIE_commands.CONNECTION_ESTABLISHED:
          parseConfig.unparseCIEModel(data, function (conn_json) {
            if (conn_json.error) {
              callback({ event: "disconnected" }); // central nao configurada
            } else {
              blockedConnection = false;
              CIEModel = conn_json;
              Controller.ping();
              if (conn_json.developerMode) {
                developerMode = true;
              }
              obj = { event: "connected", data: conn_json };
              Controller.setConnectionStatus(true, CIEModel);
            }
          });
          break;

        //ping entre o servidor e a central para interromper o modo de configuracao da central caso o ping nao responda
        case CIE_commands.PING:
          //console.log("&&& PONG");
          blockedConnection = false;
          Controller.pingAttemps = 0;
          break;

        case CIE_commands.BLOCKED_CONNECTION:
          //console.log("&&& BLOCKED_CONNECTION");

          obj = { event: "blocked" };

          clearInterval(Controller.pingInterval);
          blockedConnection = true;
          if (!blockedConnectionTimeout)
            blockedConnectionTimeout = setTimeout(function () {
              blockedConnectionTimeout = undefined;
              if (blockedConnection) {
                writeToCIE([0, 1], "CONNECT CIE"); //testa comunicacao com a central
              }
            }, 3000);
          break;

        case CIE_commands.SEND_LOOP_FRAME:
          Controller.setIsConfigurationUpdating(true);
          frameControl = 0;
          writeToCIE(
            parsedDeviceConfig[frameControl],
            "SEND DEVICE CONFIG - START"
          );
          frameControl++;
          break;

        case CIE_commands.LOOP_FRAME_RECEIVED:
          Controller.setIsConfigurationUpdating(true);
          parseConfig.unparseLoopConfig(data, function (loop_frame) {
            //console.log(
            "-- UNPARSED DEVICE FRAME -- : " + JSON.stringify(loop_frame)
            );
          CIEconfig.lacos = loop_frame;
          writeToCIE(
            CRCUtils.makeFrameStart(CIE_commands.DEVICE_FRAME_RECEIVED)
          );
      });
      break;

        //controle de envio de frames de dispositivo para a central
        case CIE_commands.SEND_DEVICE_FRAME:
  if(frameControl <parsedDeviceConfig.length) {
    writeToCIE(parsedDeviceConfig[frameControl], "SEND DEVICE CONFIG");
frameControl++;
          } else {
  frameControl = 0;
  writeToCIE(
    parsedZoneConfig[frameControl],
    "SEND ZONE CONFIG - START"
  );
  frameControl++;
}
break;

        //recebeu um frame de configuracao de dispositivo
        case CIE_commands.DEVICE_FRAME_RECEIVED:
parseConfig.unparseDeviceConfig(data, function (devices_frame) {
  //console.log(
  "-- UNPARSED DEVICE FRAME -- : " + JSON.stringify(devices_frame)
            );
var loop = CIEconfig.lacos[devices_frame.loop];
for (var i in devices_frame.devices) {
  loop.dispositivos[i] = devices_frame.devices[i];
}
CIEconfig.lacos[devices_frame.loop] = loop;
if (data.length && data.length === 128) {
  var get_frame = [0, CIE_commands.DEVICE_FRAME_RECEIVED];
  //se recebeu o ultimo frame dos dispositivos do laco (2º byte = 1), requisita o proximo laco
  if (data[1] == 1) {
    get_frame[2] = data[2] + 1;
    //senao requisita os proximos dispositivos do mesmo laco
  } else {
    get_frame[2] = data[2];
  }
  writeToCIE(get_frame, "GET DEVICE FRAME");
} else {
  writeToCIE(
    CRCUtils.makeFrameRequest(
      data,
      CIE_commands.DEVICE_FRAME_RECEIVED,
      CIE_commands.DEVICE_FRAME_RECEIVED
    )
  );
}
          });
break;

        //escanear laco
        case CIE_commands.CALL_LOOP_SCAN:
var retorno = (data[1] << 8) + data[2];

//se finalizou o scan do laço
if (retorno != 65533 && retorno > 0) {
  Controller.checkInconsistency(undefined, function (res) {
    res.event = "call_loop_scan";
    obj = res;
  });
} else if (retorno != 65533) {
  obj = {
    event: "call_loop_scan",
    data: { success: false, error: retorno },
  };
}

break;

        //recebeu um frame de configuracao dos tipos dos dispositivos apos o scan do laco
        case CIE_commands.GET_LOOP_SCAN:
Controller.setIsConfigurationUpdating(false);
var sizeControl = Object.keys(
  loopScan[data[2] - 1].dispositivos
).length;
parseConfig.unparseLoopScanConfig(
  data,
  sizeControl,
  function (frame) {
    //console.log(
    "-- UNPARSED DEVICE FRAME -- : " + JSON.stringify(frame)
              );
for (var i in frame.devices) {
  loopScan[frame.loop - 1].dispositivos[i] = frame.devices[i];
}
var get_frame = [0, CIE_commands.GET_LOOP_SCAN, 0, 1];
//se recebeu o ultimo frame dos dispositivos do laco (2º byte = 1), requisita o proximo laco
if (data[1] == 1) {
  get_frame[3] = data[2] + 1;
  //senao requisita os proximos dispositivos do mesmo laco
} else {
  get_frame[3] = data[2];
}
writeToCIE(get_frame, "GET SCAN DEVICE FRAME");
            }
          );
break;

        case CIE_commands.END_LOOP_SCAN:
loopScanReceived = true;
break;

        //recebeu um frame de configuracao da placa de rede
        case CIE_commands.GET_NETWORK_BOARD_CONFIG:
loopScanReceived = true;
networkBoard = data[1] === 1;
break;

        //central enviou toda configuracao de dispositivos. Inicia recuperacao de config de zonas
        case CIE_commands.DEVICE_CONFIG_ENDS:
writeToCIE(CRCUtils.makeFrameStart(CIE_commands.ZONE_FRAME_RECEIVED));
break;

        //controle de envio de frames de zonas para a central
        case CIE_commands.SEND_ZONE_FRAME:
if (frameControl < parsedZoneConfig.length) {
  writeToCIE(parsedZoneConfig[frameControl], "SEND ZONE CONFIG");
  frameControl++;
} else {
  frameControl = 0;
  writeToCIE(
    parsedRuleConfig[frameControl],
    "SEND RULE CONFIG - START"
  );
  frameControl++;
}
break;

        case CIE_commands.ZONE_FRAME_RECEIVED:
parseConfig.unparseZoneConfig(data, function (zones_frame) {
  //console.log(
  "--UNPARSED ZONE FRAME-- : " + JSON.stringify(zones_frame)
            );
for (var i in zones_frame.zones) {
  CIEconfig.zonas[i] = zones_frame.zones[i];
}
if (data.length && data.length === 128) {
  if (data[1] == 1) {
    var command = [0, 0x0b];
    writeToCIE(command, "GET RULE CONFIG - START");
  } else {
    writeToCIE([0, 6], "GET ZONE CONFIG");
  }
} else {
  writeToCIE(
    CRCUtils.makeFrameRequest(
      data,
      CIE_commands.ZONE_FRAME_RECEIVED,
      CIE_commands.RULE_FRAME_RECEIVED
    )
  );
}
          });
break;

        //central enviou toda configuracao de dispositivos. Inicia recuperacao de config de zonas
        case CIE_commands.ZONE_CONFIG_ENDS:
var command = [0, 0x0b];
writeToCIE(command, "GET RULE CONFIG - START");
break;

        //controle de envio de frames de REGRAS para a central
        case CIE_commands.SEND_RULE_FRAME:
if (frameControl < parsedRuleConfig.length) {
  writeToCIE(parsedRuleConfig[frameControl], "SEND RULE CONFIG");
  frameControl++;
} else {
  frameControl = 0;
  writeToCIE(
    parsedRuleItemConfig[frameControl],
    "SEND RULE_ITEM CONFIG - START"
  );
  frameControl++;
}
break;

        case CIE_commands.RULE_FRAME_RECEIVED:
parseConfig.unparseRuleConfig(data, function (rules_frame) {
  //console.log(
  "--UNPARSED RULE FRAME-- : " + JSON.stringify(rules_frame)
            );
for (var i in rules_frame.rules) {
  CIEconfig.regras[i] = rules_frame.rules[i];
}
if (data.length && data.length === 128) {
  if (data[1] == 0) {
    writeToCIE([0, 0x0b], "GET RULE CONFIG");
  } else {
    var command = [0, 0x0c, 0, 1];
    writeToCIE(command, "GET ITEM RULE CONFIG - START");
  }
} else {
  writeToCIE(
    CRCUtils.makeFrameRequest(
      data,
      CIE_commands.RULE_FRAME_RECEIVED,
      CIE_commands.RULE_ITEM_FRAME_RECEIVED,
      0,
      1
    )
  );
}
          });
break;

        //central enviou toda configuracao de REGRAS. Inicia recuperacao de config de itens das regras
        case CIE_commands.RULE_CONFIG_ENDS:
var command = [0, 0x0c, 0, 1];
writeToCIE(command, "GET ITEM RULE CONFIG - START");
break;

        //controle de envio de frames de itens das REGRAS para a central
        case CIE_commands.SEND_RULE_ITEM_FRAME:
if (frameControl < parsedRuleItemConfig.length) {
  writeToCIE(parsedRuleItemConfig[frameControl], "SEND RULE CONFIG");
  frameControl++;
} else {
  writeToCIE(parsedSystemConfig, "SEND SYSTEM CONFIG - START");
}
break;

        case CIE_commands.RULE_ITEM_FRAME_RECEIVED:
parseConfig.unparseRuleItemConfig(data, function (rule_items_frame) {
  //console.log(
  "--UNPARSED RULE ITEM FRAME-- : " +
    JSON.stringify(rule_items_frame)
            );

if (CIEconfig.regras[rule_items_frame.rule_id]) {
  if (!CIEconfig.regras[rule_items_frame.rule_id].itens)
    CIEconfig.regras[rule_items_frame.rule_id].itens = [];

  CIEconfig.regras[rule_items_frame.rule_id].itens =
    CIEconfig.regras[rule_items_frame.rule_id].itens.concat(
      rule_items_frame.items
    );
}

if (data.length && data.length === 128) {
  //se for finalizacao da regra
  if (data[1] == 1) {
    var ruleIds = Object.keys(CIEconfig.regras);
    var rulesLength = ruleIds.length;
    var lastRuleId = ruleIds[rulesLength - 1];

    //se nao for a ultima regra, requisita a proxima
    if (parseInt(lastRuleId) != rule_items_frame.rule_id) {
      var nextIndex =
        ruleIds.indexOf(rule_items_frame.rule_id.toString()) + 1;
      var nextId = parseInt(ruleIds[nextIndex]);
      var command = [
        0,
        CIE_commands.RULE_ITEM_FRAME_RECEIVED,
        0,
        nextId,
      ];
      writeToCIE(command, "GET RULE ITEM FRAME");

      //senao inicia sistema
    } else {
      var command = [0, CIE_commands.SYSTEM_FRAME_RECEIVED];
      writeToCIE(command, "GET SYSTEM CONFIG - START");
    }
  } else {
    var command = [
      0,
      CIE_commands.RULE_ITEM_FRAME_RECEIVED,
      0,
      rule_items_frame.rule_id,
    ];
    writeToCIE(command, "GET RULE ITEM FRAME");
  }
} else {
  var index = data[128];
  var length = data[129];

  if (index === length) {
    index = 1;
    length = 0;
  } else {
    index++;
  }

  //se for finalizacao da regra
  if (data[1] == 1) {
    var ruleIds = Object.keys(CIEconfig.regras);
    var rulesLength = ruleIds.length;
    var lastRuleId = ruleIds[rulesLength - 1];

    //se nao for a ultima regra, requisita a proxima
    if (parseInt(lastRuleId) != rule_items_frame.rule_id) {
      var nextIndex =
        ruleIds.indexOf(rule_items_frame.rule_id.toString()) + 1;
      var nextId = parseInt(ruleIds[nextIndex]);
      var command = [
        0,
        CIE_commands.RULE_ITEM_FRAME_RECEIVED,
        0,
        nextId,
      ];
      command = CRCUtils.concatCRC([...command, index, length]);
      writeToCIE(command, "GET RULE ITEM FRAME");

      //senao inicia sistema
    } else {
      var command = [0, CIE_commands.SYSTEM_FRAME_RECEIVED];
      command = CRCUtils.concatCRC([...command, index, length]);
      writeToCIE(command, "GET SYSTEM CONFIG - START");
    }
  } else {
    var command = [
      0,
      CIE_commands.RULE_ITEM_FRAME_RECEIVED,
      0,
      rule_items_frame.rule_id,
    ];
    command = CRCUtils.concatCRC([...command, index, length]);
    writeToCIE(command, "GET RULE ITEM FRAME");
  }
}
          });
break;

        //central enviou toda configuracao de REGRAS. Inicia recuperacao de config de itens das regras
        case CIE_commands.RULE_ITEM_CONFIG_ENDS:
var command = [0, 0x10];
writeToCIE(command, "GET SYSTEM CONFIG - START");
break;

        //controle de envio de frames de itens das REGRAS para a central
        case CIE_commands.SEND_SYSTEM_FRAME:
frameControl = 0;
writeToCIE([0, 0x0a], "SEND CONFIGURATION IS FINISHED");
break;

        case CIE_commands.SYSTEM_FRAME_RECEIVED:
parseConfig.unparseSystemConfig(data, function (system_frame) {
  //console.log(
  "--UNPARSED SYSTEM FRAME-- : " + JSON.stringify(system_frame)
            );
CIEconfig.sistema = system_frame;
writeToCIE(
  [0, CIE_commands.ALL_CONFIG_RECEIVED],
  "GET CONFIGURATION IS FINISHED"
);
          });
break;

        case CIE_commands.LOGS_FRAME_RECEIVED:
parseConfig.unparseLogsConfig(
  data,
  function (log_frame) {
    const last_event_index =
      Object.keys(config.log.events).length - 1;
    const event_type = data[2];
    const label = config.log.events[event_type].label;
    json_logs[label] = json_logs[label].concat(log_frame);

    let get_frame = [
      0,
      CIE_commands.LOGS_FRAME_RECEIVED,
      0,
      event_type,
    ];

    if (data.length === 128) {
      // Requisita mais eventos do mesmo tipo
      if (data[1] === 0) {
        get_frame[2] = event_type;
        // Se é o último tipo de evento
      } else if (event_type === last_event_index) {
        get_frame = [0, CIE_commands.ALL_LOGS_RECEIVED];
        // Requisita o próximo tipo de evento
      } else {
        get_frame[3] = event_type + 1;
      }
      writeToCIE(get_frame, "GET LOG FRAME X");
    } else {
      ////console.log("Entrou no segundo else")
      let index = CRCUtils.read16(data, 128);
      let length = CRCUtils.read16(data, 130);

      const progressFormatted = ((index / length) * 100).toFixed(2);

      if (callback) {
        callback({
          index,
          length,
          progress: progressFormatted,
          event_type: event_type,
          last_event_index: last_event_index,
        });
      }
      // Requisita mais eventos do mesmo tipo
      if (data[1] === 0) {
        get_frame[2] = event_type;
        index++;
        // Se é o último tipo de evento
      } else if (event_type === last_event_index) {
        index = 1;
        length = 0;
        get_frame = [0, CIE_commands.ALL_LOGS_RECEIVED];
        // Requisita o próximo tipo de evento
      } else {
        index = 1;
        length = 0;
        get_frame[3] = event_type + 1;
      }
      writeToCIE(
        CRCUtils.concatCRC([
          ...get_frame,
          ...CRCUtils.write16(index),
          ...CRCUtils.write16(length),
        ])
      );
    }
  },
  (progress) => {
    writeToCIE({
      event: "get_logs",
      data: {
        progress: progress.toFixed(2),
      },
    });
  }
);
break;

        case CIE_commands.FIRMWARE_FINISHED:
if (data[1] == 0) {
  //console.log(">>> FIRMWARE " + data[1]);
  obj = { event: "firmware", data: { success: true } };
  firmwareUpdating = false;
  Controller.stopUsbCommunication(true);
} else {
  if (firmwareUpdating) {
    obj = {
      event: "firmware",
      data: { success: false },
    };
  } else {
    obj = undefined;
  }
  firmwareUpdating = false;
}
parsedFirmware = [];
clearTimeout(checkFirmareTimeout);

break;

        case CIE_commands.SEND_FIRMWARE:
try {
  if (Controller.hasConnection()) {
    //comando 1 frame de firmware
    if (frameControl < parsedFirmware.frames.length) {
      writeToCIE(
        Array.from(parsedFirmware.frames[frameControl]),
        "FIRMWARE " +
        frameControl +
        " de " +
        parsedFirmware.frames.length
      );
      var progress = Math.round(
        100 * (frameControl / parsedFirmware.frames.length)
      );
      if (progress !== lastProgressSent) {
        obj = {
          event: "firmware",
          data: { progress },
        };
        lastProgressSent = progress;
      }
      frameControl++;

      //comando 2 - frame do CRC
    } else {
      writeToCIE(Array.from(parsedFirmware.crc), "CRC");
    }

    firmwareUpdating = true;
  } else {
    obj = {
      event: "fiwmware",
      data: { success: false },
    };
  }
} catch (e) {
  obj = undefined;
  //console.log("ERRO SEND_FIRMWARE");
  Controller.stopUsbCommunication();
  //console.log(e);
}

break;

        //todas as configuracoes ja foram enviadas da central para o server e podem ser passadas para a interface
        case CIE_commands.ALL_CONFIG_RECEIVED:
CIEconfig.regras = Controller.verifyRulesLoopZero(
  CIEconfig.regras,
  "remove"
);

var localDevices = {};
//separa os dispositivos locais
config.dispositivos_locais.forEach(function (id) {
  localDevices[id] = CIEconfig.lacos[0].dispositivos[id];
  if (localDevices[id])
    localDevices[id].saida_local =
      config.dispositivos_locais_nomes[id];
});
CIEconfig.lacos[0].dispositivos = localDevices;

//seta a tag de saida padrao para os dispositivos
["alarme", "falha", "supervisao"].forEach(function (type) {
  var output = CIEconfig.sistema[type];
  if (output.habilitada && output.endereco != 0) {
    CIEconfig.lacos[output.laco].dispositivos[
      output.endereco
    ].saida_padrao = true;
  }
});

//se a zona de um dispositivo local repetidora for 0, ela está desconfigurada, então remove o dispositivo
["16", "17", "18", "19"].forEach(function (addr) {
  if (
    CIEconfig.lacos[0].dispositivos[addr] &&
    CIEconfig.lacos[0].dispositivos[addr].zona === 0
  )
    delete CIEconfig.lacos[0].dispositivos[addr];
});

Controller.setIsConfigurationUpdating(false);

obj = {
  event: "get_configuration",
  data: { success: true, config: CIEconfig },
};

break;

        //configuracao foi toda gravada com sucesso na central
        case CIE_commands.ALL_CONFIG_SENT:
obj = {
  event: "send_configuration",
  data: { success: true, type: "end" },
};
Controller.setIsConfigurationUpdating(false);
break;

        //configuracao da REPETIDORA foi toda gravada com sucesso na central
        case CIE_commands.SEND_CRE_CONFIG:
obj = {
  event: "send_configuration",
  data: { success: true, type: "end" },
};
Controller.setIsConfigurationUpdating(false);
break;

        //todas as configuracoes da REPETIDORA ja foram enviadas da central para o server e podem ser passadas para a interface
        case CIE_commands.GET_CRE_CONFIG:
parseConfig.unparseCREConfig(data, function (cre_frame) {
  //console.log(
  "--UNPARSED CRE FRAME-- : " + JSON.stringify(cre_frame)
            );
obj = {
  event: "get_configuration_repeater",
  data: { success: true, config: cre_frame },
};
          });
Controller.setIsConfigurationUpdating(false);
break;

        //configuracao foi toda gravada com sucesso na central
        case CIE_commands.ALL_LOGS_RECEIVED:
Controller.setIsConfigurationUpdating(false);
obj = {
  event: "get_logs",
  data: { success: true, logs: json_logs },
};
json_logs = {
  alarme: [],
  falha: [],
  supervisao: [],
  operacao: [],
};
break;

        //configuracao foi toda gravada com sucesso na central
        case CIE_commands.DATE_SET:
Controller.setIsConfigurationUpdating(false);
obj = { event: "set_date", data: { success: true } };
break;

        case CIE_commands.GET_DATE:
parseConfig.unparseDate(data, function (date_frame) {
  //console.log(
  "--UNPARSED DATE FRAME-- : " + JSON.stringify(date_frame)
            );
obj = { event: "get_date", data: date_frame };
obj.data.success = true;
          });
break;

        case CIE_commands.RESET_LOGS:
obj = { event: "reset_logs", data: { success: true } };
obj.data.success = true;
break;

        case CIE_commands.RESET_CONFIG:
obj = { event: "reset_config", data: { success: true } };
obj.data.success = true;
break;

        case CIE_commands.GET_INFO:
parseConfig.unparseInfo(data, function (frame) {
  //console.log("--UNPARSED INFO FRAME-- : " + JSON.stringify(frame));
  obj = { event: "get_info", data: frame };
  obj.data.success = true;
});
break;

        case CIE_commands.BLOCK:
obj = { event: "block", data: {} };
obj.data.success = true;
//console.log(" CIE_commands.BLOCK");
Controller.stopUsbCommunication(true);
if (tcpManager) tcpManager.close();
if (client) client.end();
break;

        case CIE_commands.NAK_NETWORK:
//console.log("NAK_NETWORK");
return;
break;

        case CIE_commands.FLASH_DUMP:
//iniciar a gravação do dump
if (data[1] == 1) {
  try {
    fs.closeSync(fs.openSync(dumpFile, "w"));
    writeToCIE([0, CIE_commands.FLASH_DUMP, 2], "START DUMP");
    obj = {
      event: "get_flash_dump",
      data: { success: true, type: "start" },
    };
  } catch (e) {
    obj = {
      event: "flash_dump_finish",
      data: { success: false },
    };
    developerMode = false;
  }

  //salvar em arquivo
} else if (data[1] == 2) {
  try {
    var dataFrame = data.slice(3, data.length);
    fs.appendFileSync(
      dumpFile,
      Buffer.from(dataFrame, "binary"),
      "binary"
    );
    writeToCIE([0, CIE_commands.FLASH_DUMP, 2], "START DUMP");
  } catch (e) {
    obj = {
      event: "flash_dump_finish",
      data: { success: false },
    };
    developerMode = false;
  }

  //salvar o frame cortado (6 bytes)
} else if (data[1] == 3) {
  try {
    var dataFrame = data.slice(3, 9);
    fs.appendFileSync(
      dumpFile,
      Buffer.from(dataFrame, "binary"),
      "binary"
    );
    writeToCIE([0, CIE_commands.FLASH_DUMP, 2], "START DUMP");
  } catch (e) {
    obj = {
      event: "flash_dump_finish",
      data: { success: false },
    };
    developerMode = false;
  }

  //finalizar
} else if (data[1] == 4) {
  obj = {
    event: "flash_dump_finish",
    data: { success: true, path: dumpFile },
  };
  dumpFile = "";
}

break;

        case CIE_commands.SET_GATEWAY_FLASH_DUMP:
//iniciar a gravação do dump
if (data[1] == 0) {
  if (frameControl < 786432) {
    try {
      var dataFrame = data.slice(2, 98);
      fs.appendFileSync(
        dumpFile,
        Buffer.from(dataFrame, "binary"),
        "binary"
      );
      var frameRequestDump = new Uint8Array(128);
      frameRequestDump[1] =
        config.CIE_commands.SET_GATEWAY_FLASH_DUMP;
      var frameBuffer = new Buffer.alloc(4);
      frameControl += 96;
      frameBuffer.writeUInt32LE(frameControl);
      frameRequestDump.set(frameBuffer, 3);
      writeToCIE(
        frameRequestDump,
        "SET_GATEWAY_FLASH_DUMP " + frameControl
      );
      obj = {
        event: "gateway_save_dump",
        data: {
          success: true,
          progress: Math.round((frameControl / 786432) * 100),
        },
      };
    } catch (e) {
      obj = {
        event: "gateway_save_dump",
        data: { success: false },
      };
    }
  } else {
    writeToCIE(
      [0, CIE_commands.SET_GATEWAY_FLASH_DUMP, 4],
      "SET_GATEWAY_FLASH_DUMP " + 4
    );
  }
  //finalizar
} else if (data[1] == 4) {
  obj = {
    event: "gateway_save_dump",
    data: { success: true, end: true },
  };
  dumpFile = "";
}

break;

        case CIE_commands.SET_GATEWAY_INFO:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_MODBUS_INFO");
break;

        case CIE_commands.SET_MODBUS_INFO:
frameControl++;
writeToCIE(
  parsedGatewayConfig[frameControl],
  "SET_PROG_SITUATOR_INFO"
);
break;

        case CIE_commands.SET_PROG_SITUATOR_INFO:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_SITUATOR_LOGIN");
break;

        case CIE_commands.SET_SITUATOR_LOGIN:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_SITUATOR_TOKEN");
break;

        case CIE_commands.SET_SITUATOR_TOKEN:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_SITUATOR_HOST");
break;

        case CIE_commands.SET_SITUATOR_HOST:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_WEBHOOK_INFO");
break;

        case CIE_commands.SET_WEBHOOK_INFO:
frameControl++;
writeToCIE(
  parsedGatewayConfig[frameControl],
  "SET_WEBHOOK_HMAC_PRIVKEY"
);
break;

        case CIE_commands.SET_WEBHOOK_HMAC_PRIVKEY:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_WEBHOOK_HOST");
break;

        case CIE_commands.SET_WEBHOOK_HOST:
frameControl++;
writeToCIE(
  parsedGatewayConfig[frameControl],
  "SET_WEBHOOOK_ENDPOINT"
);
break;

        case CIE_commands.SET_WEBHOOK_ENDPOINT:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_RCPTIP_INFO");
break;

        case CIE_commands.SET_RCPTIP_INFO:
frameControl++;
writeToCIE(parsedGatewayConfig[frameControl], "SET_RCPTIP_HOST");
break;

        case CIE_commands.SET_RCPTIP_HOST:
verifyGatewayCertsSendControl();
gatewayCertsSend();
break;

        case CIE_commands.PROG_DEL_SSLTLS:
switch (data[1]) {
  case 0:
    certificatesControl["root_ca"] = "sent";
    break;
  case 1:
    certificatesControl["self_ca"] = "sent";
    break;
  case 2:
    certificatesControl["self_ca_pk"] = "sent";
    break;
}
gatewayCertsSend();

break;

        case CIE_commands.SET_SSLTLS_ROOT_CA:
sendCertificateFrames("root_ca", data);
break;

        case CIE_commands.SET_SSLTLS_SELF_CERT:
sendCertificateFrames("self_ca", data);
break;

        case CIE_commands.SET_SSLTLS_SELF_CERT_PK:
sendCertificateFrames("self_ca_pk", data);
break;

        case CIE_commands.GET_GATEWAY_INFO:
receivedGatewayFrames.push(data);
if (configurationUpdating) {
  writeToCIE([0, CIE_commands.GET_MODBUS_INFO], "GET_MODBUS_INFO");
} else {
  parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
    //console.log(
    "--UNPARSED GATEWAY FRAME-- : " + JSON.stringify(gateway_frame)
              );
  obj = {
    event: "get_info_gateway",
    data: {
      success: true,
      config: gateway_frame,
    },
  };
});
          }
break;

        case CIE_commands.SET_GATEWAY_MAC:
if (data[1] === 0) {
  obj = {
    event: "gateway_change_mac",
    data: { success: true },
  };
} else {
  obj = {
    event: "gateway_change_mac",
    data: { success: false },
  };
}
break;

        case CIE_commands.SET_GATEWAY_ERASE_EVENTS:
if (data[1] === 0) {
  obj = {
    event: "gateway_clear_registers",
    data: { success: true },
  };
} else {
  obj = {
    event: "gateway_clear_registers",
    data: { success: false },
  };
}
break;

        case CIE_commands.SET_GATEWAY_RESET_FABRICA:
if (data[1] === 0) {
  obj = {
    event: "gateway_factory_reset",
    data: { success: true },
  };
  Controller.stopUsbCommunication(true);
  if (tcpManager) tcpManager.close();
} else {
  obj = {
    event: "gateway_factory_reset",
    data: { success: false },
  };
}
break;

        case CIE_commands.SET_GATEWAY_RESET:
obj = { event: "gateway_restart", data: { success: true } };
break;

        case CIE_commands.GET_GATEWAY_ERRORS:
parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
  //console.log(
  "--UNPARSED GATEWAY FRAME-- : " + JSON.stringify(gateway_frame)
            );
obj = {
  event: "get_gateway_errors",
  data: { success: true, config: gateway_frame },
};
          });
break;

        // case CIE_commands.RESET_GATEWAY_FLASH:
        //     obj = {
        //         event: "send_configuration",
        //         data: { success: true, type: "end" },
        //     };
        //     Controller.setIsConfigurationUpdating(false);
        //     break;

        case CIE_commands.GET_MODBUS_INFO:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_PROG_SITUATOR_INFO],
  "GET_PROG_SITUATOR_INFO"
);
break;

        case CIE_commands.GET_PROG_SITUATOR_INFO:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_SITUATOR_LOGIN],
  "GET_SITUATOR_LOGIN"
);
break;

        case CIE_commands.GET_SITUATOR_LOGIN:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_SITUATOR_TOKEN],
  "GET_SITUATOR_TOKEN"
);
break;

        case CIE_commands.GET_SITUATOR_TOKEN:
receivedGatewayFrames.push(data);
writeToCIE([0, CIE_commands.GET_SITUATOR_HOST], "GET_SITUATOR_HOST");
break;

        case CIE_commands.GET_SITUATOR_HOST:
receivedGatewayFrames.push(data);
writeToCIE([0, CIE_commands.GET_WEBHOOK_INFO], "GET_WEBHOOK_INFO");
break;

        case CIE_commands.GET_WEBHOOK_INFO:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_WEBHOOK_HMAC_PRIVKEY],
  "GET_WEBHOOK_HMAC_PRIVKEY"
);
break;

        case CIE_commands.GET_WEBHOOK_HMAC_PRIVKEY:
receivedGatewayFrames.push(data);
writeToCIE([0, CIE_commands.GET_WEBHOOK_HOST], "GET_WEBHOOK_HOST");
break;

        case CIE_commands.GET_WEBHOOK_HOST:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_WEBHOOK_ENDPOINT],
  "GET_WEBHOOK_ENDPOINT"
);
break;

        case CIE_commands.GET_WEBHOOK_ENDPOINT:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_SSLTLS_ROOT_CA],
  "GET_SSLTLS_ROOT_CA"
);
break;

        case CIE_commands.GET_SSLTLS_ROOT_CA:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_SSLTLS_SELF_CERT],
  "GET_SSLTLS_SELF_CERT"
);
break;

        case CIE_commands.GET_SSLTLS_SELF_CERT:
receivedGatewayFrames.push(data);
writeToCIE(
  [0, CIE_commands.GET_SSLTLS_SELF_CERT_PK],
  "GET_SSLTLS_SELF_CERT_PK"
);
break;

        case CIE_commands.GET_SSLTLS_SELF_CERT_PK:
receivedGatewayFrames.push(data);
writeToCIE([0, CIE_commands.GET_RCPTIP_INFO], "GET_RCPTIP_INFO");
break;

        case CIE_commands.GET_RCPTIP_INFO:
receivedGatewayFrames.push(data);
writeToCIE([0, CIE_commands.GET_RCPTIP_HOST], "GET_RCPTIP_HOST");
break;
        case CIE_commands.GET_RCPTIP_HOST:
receivedGatewayFrames.push(data);
parseConfig.unparseGatewayConfig(
  receivedGatewayFrames,
  function (gateway_frame) {
    //console.log(
    "--UNPARSED GATEWAY FRAME-- : " + JSON.stringify(gateway_frame)
              );

if (gateway_frame.sistema && gateway_frame.sistema.pwd_prog_cie) {
  const pwd_prog = gateway_frame.sistema.pwd_prog_cie;
  const default_pwd = "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ";
  if (pwd_prog === default_pwd) {
    gateway_frame.sistema.pwd_prog_cie = "";
  }
}

obj = {
  event: "get_configuration_gateway",
  data: { success: true, config: gateway_frame },
};
            }
          );
Controller.setIsConfigurationUpdating(false);
break;

        case CIE_commands.SET_GATEWAY_ADVANCED_CMDS:
parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
  obj = {
    event: "auth_gateway_advanced_commands",
    data: { success: true, gateway_frame },
  };
});
break;

        case CIE_commands.GET_GATEWAY_LOG:
parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
  obj = {
    event: "gateway_get_log",
    data: { success: true, gateway_frame },
  };
});
break;
      }

if (obj != undefined) {
  Controller.callbackWriteWebsoket(obj); //comunicou com a central
  obj = undefined;
}
    } catch (e) {
  //console.log("ERRO CommunicationHandler");
  //console.log(e);
}
  },

getInconsistencyConfig: function (configuration) {
  if (!configuration) {
    configuration = {
      lacos: [
        { dispositivos: {} },
        { dispositivos: {} },
        { dispositivos: {} },
        { dispositivos: {} },
      ],
    };
  }
  var inconsistency = [];

  //percorre os dispositivos e compara com o scan para verificar se o tipo é diferente
  for (var loopId = 0; loopId < configuration.lacos.length - 1; loopId++) {
    var loop = configuration.lacos[loopId + 1]; //+1 para descartar laco 0
    for (var id in loop.dispositivos) {
      var deviceType = parseInt(loop.dispositivos[id].tipo);
      var scanDeviceType = loopScan[loopId].dispositivos[id];
      var type = "tipo";
      //se o tipo for diferente significa inconsistencia
      if (deviceType != scanDeviceType) {
        //se for 0 significa que nao existe mais o dispositivo
        if (scanDeviceType == 0) {
          type = "removido";
        }
        inconsistency.push({
          inconsistency: type,
          endereco: parseInt(id),
          laco: loopId + 1,
          tipo: deviceType,
          novoTipo: scanDeviceType,
          nome: loop.dispositivos[id].nome,
        });
      }
    }
  }

  //percorre o scan para verificar se ha novos dispositivos que estao na central e nao na configuracao
  for (var loopId = 0; loopId < configuration.lacos.length - 1; loopId++) {
    var loop = loopScan[loopId]; //+1 para descartar laco 0
    for (var id in loop.dispositivos) {
      var scanDeviceType = loop.dispositivos[id];
      var device = configuration.lacos[loopId + 1].dispositivos[id];
      if (scanDeviceType != 0 && device === undefined) {
        var type = "novo";
        inconsistency.push({
          inconsistency: type,
          endereco: parseInt(id),
          laco: loopId + 1,
          tipo: scanDeviceType,
          novoTipo: scanDeviceType,
          nome: "",
        });
      }
    }
  }

  loopScan = [
    { dispositivos: {} },
    { dispositivos: {} },
    { dispositivos: {} },
    { dispositivos: {} },
  ];
  return inconsistency;
},

checkInconsistency: function (configuration, callback) {
  if (Controller.hasConnection()) {
    Controller.setIsConfigurationUpdating(true);
    Controller.getLoopScan();
    check();

    function check() {
      if (Controller.hasConnection()) {
        if (loopScanReceived) {
          var inconsistency =
            Controller.getInconsistencyConfig(configuration);
          callback({
            inconcistency: inconsistency.length > 0,
            event: "send_configuration",
            data: {
              success: true,
              inconsistency: inconsistency.length > 0,
              config: inconsistency,
            },
          });
        } else {
          clearTimeout(loopScanTimeout);
          loopScanTimeout = setTimeout(function () {
            check();
          }, 3000);
        }
      } else {
        loopScanReceived = false;
        clearTimeout(loopScanTimeout);
      }
    }
  } else {
    callback({ event: "error", type: "disconnected" });
    clearTimeout(loopScanTimeout);
  }
},

checkNetworkBoard: function (callback) {
  if (Controller.hasConnection()) {
    networkBoard = false;
    Controller.setIsConfigurationUpdating(true);
    Controller.getNetworkBoardConfig();
    check();

    function check() {
      if (Controller.hasConnection()) {
        if (loopScanReceived) {
          callback(networkBoard);
        } else {
          clearTimeout(loopScanTimeout);
          loopScanTimeout = setTimeout(function () {
            check();
          }, 1000);
        }
      } else {
        loopScanReceived = false;
        clearTimeout(loopScanTimeout);
      }
    }
  } else {
    callback({ event: "error", type: "disconnected" });
  }
},

sendConfigAndSave: function (db, callback) {
  db = exeptionsHandle(db);
  Controller.setIsConfigurationUpdating(true);
  if (Controller.hasConnection()) {
    parseConfig.loopConfig(db.lacos, function (loop_frame) {
      parsedLoopConfig = loop_frame;
      parseConfig.devicesConfig(
        db.lacos,
        db.regras,
        function (device_frames) {
          parsedDeviceConfig = device_frames;
          parseConfig.parseZoneConfig(
            db.zonas,
            db.regras,
            function (zone_frames) {
              parsedZoneConfig = zone_frames;
              parseConfig.parseRuleConfig(db.regras, function (rule_frames) {
                parsedRuleConfig = rule_frames;
                parseConfig.parseRuleItemConfig(
                  db.regras,
                  function (rule_item_frames) {
                    parsedRuleItemConfig = rule_item_frames;
                    parseConfig.parseSystemConfig(
                      db.sistema,
                      function (system_frames) {
                        parsedSystemConfig = system_frames;
                        writeToCIE(parsedLoopConfig, "SEND LOOP CONFIG");
                      }
                    );
                  }
                );
              });
            }
          );
        }
      );
    });
  } else {
    callback({ event: "error", type: "disconnected" });
  }
},

sendCREConfig: function (sistema, callback) {
  Controller.setIsConfigurationUpdating(true);
  if (Controller.hasConnection()) {
    parseConfig.parseCREConfig(sistema, function (cre_frame) {
      writeToCIE(cre_frame, "SEND CRE CONFIG");
    });
  } else {
    callback({ event: "error", type: "disconnected" });
  }
},

sendGatewayConfig: function (config, callback) {
  parsedGatewayConfig = [];
  parsedCertificatesFrames = {};
  certificatesInfo = {};
  Controller.setIsConfigurationUpdating(true);
  if (Controller.hasConnection()) {
    parseConfig.parseGatewayConfig(
      config,
      function (frames, certificates, savedCertificates) {
        frameControl = 0;
        parsedGatewayConfig = frames;
        parsedCertificatesFrames = certificates;
        certificatesInfo = savedCertificates;
        writeToCIE(frames[0], "SEND GATEWAY CONFIG");
      }
    );
  } else {
    callback({ event: "error", type: "disconnected" });
  }
},

getLoopScan: function (callback) {
  loopScanReceived = false;
  if (Controller.hasConnection()) {
    Controller.setIsConfigurationUpdating(true);
    writeToCIE([0, CIE_commands.GET_LOOP_SCAN, 0, 1], "GET LOOP SCAN");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getNetworkBoardConfig: function (callback) {
  loopScanReceived = false;
  if (Controller.hasConnection()) {
    writeToCIE(
      [0, CIE_commands.GET_NETWORK_BOARD_CONFIG, 0, 1],
      "GET NETWORK BOARD CONFIG"
    );
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

callLoopScan: function (loop, callback) {
  loopScanReceived = false;
  if (Controller.hasConnection()) {
    check();
    function check() {
      clearTimeout(loopScanTimeout);
      if (!loopScanReceived) {
        writeToCIE([0, CIE_commands.CALL_LOOP_SCAN, loop], "CALL LOOP SCAN");
        loopScanTimeout = setTimeout(function () {
          check();
        }, 5000);
      }
    }
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

//se o botao de alarme ou chamar brigada estiver configurado, adiciona ou remove da regra, para posteriormente gerar a mascara de regras
verifyRulesLoopZero: function (regras, action) {
  var configs = {
    alarme: {
      endereco: 14,
      nome: "Alarme Geral",
    },
    brigada: {
      endereco: 15,
      nome: "Chamar Brigada",
    },
  };
  for (var idRegra in regras) {
    var regra = regras[idRegra];
    if (action == "add") {
      for (var virtualDevice in configs) {
        if (regra[virtualDevice]) {
          regra.itens.push({
            laco: 0,
            nome: configs[virtualDevice].nome,
            endereco: configs[virtualDevice].endereco,
            subtipo: 12,
            tipo: "evento",
            modo: "entrada",
          });
        }
      }
    } else {
      for (var i = 0; i < regra.itens.length; i++) {
        var item = regra.itens[i];
        if (
          (item.tipo == "evento" &&
            item.endereco == configs.alarme.endereco) ||
          (item.tipo == "evento" && item.endereco == configs.brigada.endereco)
        ) {
          regra.itens.splice(i, 1);
          i--;
        }
      }
    }
  }
  return regras;
},

getCIEconfig: function (callback) {
  if (Controller.hasConnection()) {
    CIEconfig = {
      sistema: {},
      zonas: {},
      regras: {},
      lacos: [
        { dispositivos: {} },
        { dispositivos: {} },
        { dispositivos: {} },
        { dispositivos: {} },
      ],
    };
    var command = [0, 34, 1];
    writeToCIE(command, "GET CONFIGURATION FROM CIE");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getCREconfig: function (callback) {
  if (Controller.hasConnection()) {
    CIEconfig = {
      sistema: {},
    };
    var command = [0, CIE_commands.GET_CRE_CONFIG];
    writeToCIE(command, "GET CONFIGURATION FROM CRE");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getGatewayConfig: function (callback) {
  if (Controller.hasConnection()) {
    Controller.setIsConfigurationUpdating(true);
    receivedGatewayFrames = [];
    var command = [0, CIE_commands.GET_GATEWAY_INFO];
    writeToCIE(command, "GET_GATEWAY_INFO");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getCIELogs: function (callback) {
  if (Controller.hasConnection()) {
    Controller.setIsConfigurationUpdating(true);
    var frame = [0, CIE_commands.LOGS_FRAME_RECEIVED, 0, 0];
    writeToCIE(
      CRCUtils.concatCRC([
        ...frame,
        ...CRCUtils.write16(1),
        ...CRCUtils.write16(0),
      ])
    );
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

resetConfig: function (callback) {
  if (Controller.hasConnection()) {
    var command = [0, 0x1c];
    writeToCIE(command, "RESET CONFIG");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

resetLogs: function (callback) {
  if (Controller.hasConnection()) {
    var command = [0, 0x1d];
    writeToCIE(command, "RESET LOGS");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getDate: function (callback) {
  if (Controller.hasConnection()) {
    var command = [0, 0x1a];
    writeToCIE(command, "GET DATE FROM CIE");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

setDate: function (dh, callback) {
  if (Controller.hasConnection()) {
    Controller.setIsConfigurationUpdating(true);
    parseConfig.parseDate(dh, function (dh_frame) {
      writeToCIE(dh_frame, "SET DATE OF CIE");
    });
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

block: function (callback) {
  if (Controller.hasConnection()) {
    writeToCIE([0, CIE_commands.BLOCK], "BLOCK CENTRAL");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getInfo: function (callback) {
  if (Controller.hasConnection()) {
    writeToCIE([0, 32], "GET INFO OF CIE");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getInfoGateway: function (callback) {
  if (Controller.hasConnection()) {
    writeToCIE([0, CIE_commands.GET_GATEWAY_INFO], "GET_GATEWAY_INFO");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

gatewayChangeMac: function (mac, callback) {
  if (Controller.hasConnection()) {
    var gatewayMacFrame = parseConfig.parseGatewayMac(mac);
    writeToCIE(gatewayMacFrame, "SET_GATEWAY_MAC");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

gatewayClearRegister: function (callback) {
  if (Controller.hasConnection()) {
    writeToCIE(
      [0, CIE_commands.SET_GATEWAY_ERASE_EVENTS],
      "SET_GATEWAY_ERASE_EVENTS"
    );
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

gatewayFactoryReset: function (callback) {
  if (Controller.hasConnection()) {
    writeToCIE(
      [0, CIE_commands.SET_GATEWAY_RESET_FABRICA],
      "SET_GATEWAY_RESET_FABRICA"
    );
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

gatewayRestart: function (callback) {
  if (Controller.hasConnection()) {
    writeToCIE([0, CIE_commands.SET_GATEWAY_RESET], "SET_GATEWAY_RESET");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getInfoGatewayErrors: function (callback) {
  if (Controller.hasConnection()) {
    writeToCIE([0, CIE_commands.GET_GATEWAY_ERRORS], "GET_GATEWAY_ERRORS");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getFlashDump: function (path, callback) {
  if (Controller.hasConnection()) {
    dumpFile = path;
    writeToCIE([0, CIE_commands.FLASH_DUMP, 1], "GET FLASH DUMP");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

getGatewayFlashDump: function (path, callback) {
  if (Controller.hasConnection()) {
    var filename =
      "\\DUMP_Gateway_GW521_" + new Date().toLocaleString() + ".bin";
    filename = filename.replace(/:/g, "-").replace(/\//g, "-");
    dumpFile = path + filename;
    frameControl = 0;
    fs.writeFile(dumpFile, "", function (err) {
      if (!err) {
        writeToCIE(
          [0, CIE_commands.SET_GATEWAY_FLASH_DUMP, 0],
          "SET_GATEWAY_FLASH_DUMP 0"
        );
      } else {
        obj = {
          event: "flash_dump_finish",
          data: { success: false },
        };
      }
    });
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

authGatewayAdvancedCommands: function (data, callback) {
  if (Controller.hasConnection()) {
    var authGatewayAdvancedFrame =
      parseConfig.parseGatewayAdvancedCommands(data);
    writeToCIE(authGatewayAdvancedFrame, "SET_GATEWAY_ADVANCED_CMDS");
  } else {
    callback({ event: "error", data: { type: "disconnected" } });
  }
},

gatewayGetLog: function (callback) {
  if (Controller.hasConnection()) {
    setTimeout(function () {
      isCriticalCommand = true;
      gatewayLogGetting = true;
      writeToCIE([0, CIE_commands.GET_GATEWAY_LOG], "GET_GATEWAY_LOG");
    }, 25);
  } else {
    callback({ event: "gateway_get_log", data: { error: true } });
  }
},

parseCertificateFile: function (data, command, callback) {
  parseConfig.parseFirmware(data, command, function (parsed) {
    callback(parsed);
  });
},
sendFirmware: function (data, callback) {
  try {
    function checkFirmareUpdating() {
      //console.log("checkFirmareUpdating", firmwareUpdating);
      clearTimeout(checkFirmareTimeout);
      if (!firmwareUpdating) {
        firmwareUpdating = true;
        Controller.stopUsbCommunication(true);
      } else {
        checkFirmareTimeout = setTimeout(function () {
          checkFirmareUpdating();
        }, 10000);
        firmwareUpdating = false;
      }
    }

    // if (Controller.hasConnection()) {
    parseConfig.parseFirmware(
      data,
      CIE_commands.SEND_FIRMWARE,
      function (parsed) {
        parsedFirmware = parsed;
        writeToCIE(Array.from(parsedFirmware.lengthFrame));
        callback({ error: false });
        frameControl = 0;
        lastProgressSent = undefined;
        firmwareUpdating = true;
        setTimeout(function () {
          checkFirmareUpdating();
        }, 20000);
      }
    );
    // } else {
    //     callback({error: true});
    // }
  } catch (e) {
    callback({ error: true });
    //console.log("ERRO sendFirmware");
    Controller.stopUsbCommunication();
    //console.log(e);
  }
},
pingAttemps: 0,
  pingReceived: false,
    commandReceived: true,
      pingInterval: undefined,
        ping: function () {
          var this_ = this;
          clearTimeout(this.pingInterval);
          this_.pingInterval = setInterval(function () {
            if (!configurationUpdating && !firmwareUpdating && !isCriticalCommand) {
              //console.log(
              "$$$ PING",
                configurationUpdating,
                firmwareUpdating,
                this.pingAttemps
        );

          writeToCIE([0, CIE_commands.PING], "PING CIE");
          this.pingAttemps++;
        }

if (this_.pingAttemps > 1) {
  Controller.commandReceived = false;
}

if (this_.pingAttemps >= 20) {
  //console.log("$$$ PING 20 TENTATIVAS");
  this_.stopUsbCommunication();
}
    }, config.PING_INTERVAL);
  },
startTestUSB: function () {
  clearInterval(usbInterval);
  usbInterval = setInterval(function () {
    Controller.testUsbConnection();
  }, 2000);
},
stopGatUSB: function () {
  writeToCIE([0, 255], "Gateway Closed");
},
stopTestUSB: function () {
  clearTimeout(usbInterval);
},
stopUsbCommunication: function (changedConnectionMode) {
  //console.log("TERMINA CONEXAO");

  if (USB_HID && USB_HID._paused) {
    USB_HID = undefined;
  }
  clearInterval(Controller.pingInterval);
  clearInterval(usbInterval);

  if (changedConnectionMode == true) {
    Controller.callbackWriteWebsoket({ event: "disconnected" });
  } else {
    Controller.callbackWriteWebsoket({ event: "error" });
  }

  if (firmwareUpdating) {
    Controller.callbackWriteWebsoket({
      event: "firmware_error_on_update",
    });
    firmwareUpdating = false;
  }
  if (configurationUpdating) {
    Controller.callbackWriteWebsoket({
      event: "configuration_error_on_update",
    });
    Controller.setIsConfigurationUpdating(false);
  }
  if (developerMode) {
    developerMode = false;
  }
  if (loopScanReceived === false) {
    Controller.callbackWriteWebsoket({ event: "error_on_loop_scan" });
    loopScanReceived = true;
  }
  if (gatewayLogGetting) {
    Controller.callbackWriteWebsoket({
      event: "gateway_get_log",
      data: { error: true },
    });
    gatewayLogGetting = false;
  }
  this.pingAttemps = 0;
  Controller.stopCommunicationFn();
},
callbackWriteWebsoket: undefined,
  callbackProcessLogs: undefined,
    hasCIEOnUsbConnected: function () {
      var devices = HID.devices();
      for (var i = 0; i < devices.length; i++) {
        if (devices[i].vendorId == 1003 && devices[i].productId == 9218) {
          return true;
        }
      }
      return false;
    },
testUsbConnection: function () {
  if (!USB_HID) {
    if (Controller.hasCIEOnUsbConnected()) {
      try {
        USB_HID = new HID.HID(1003, 9218);
        //console.log("Abriu Conexao HID Central CIE");

        USB_HID.on("data", function (data) {
          // //console.log('DATA', data);
          Controller.CommunicationHandler(data, config.connectionsMode.USB);
        });

        USB_HID.on("error", function (err) {
          //console.log("ERROR HID");
          Controller.stopUsbCommunication(true);
          //console.log(err);
        });

        Controller.stopTestUSB();
        writeToCIE([0, 1], "CONNECT CIE");
        return { event: "blocked" };
      } catch (e) {
        //console.log("ERRO NEW HID");
        //console.log(e);
        return { event: "disconnected" };
      }
    }

    return { event: "disconnected" };
  } else if (USB_HID._paused == false) {
    Controller.stopTestUSB();
    writeToCIE([0, 1], "CONNECT CIE");
    return { event: "blocked" };
  } else {
    return blockedConnection
      ? { event: "blocked" }
      : { event: "connected", data: CIEModel };
  }
},
sendUSBFn: function (data) {
  try {
    if (USB_HID && USB_HID.write) {
      USB_HID.resume();
      USB_HID.write(data);
    }
  } catch (e) {
    //console.log("sendUSBFn ERRIR", e);
    Controller.stopUsbCommunication();
  }
},
sendTCPFn: (data) => {
  try {
    if (!client) {
      //console.log("Client is not connected, skipping write operation");
      return;
    }

    if (!client.writable) {
      //console.log("Client socket is not writable, skipping write operation");
      return;
    }

    client.write(data);
  } catch (err) {
    console.error(err);
    client.end();
  }
},
  createAuthFrame: (password) => {
    const frame = Buffer.alloc(128).fill(0);
    frame[0] = config.CIE_commands.SET_GATEWAY_AUTH_ETH;
    frame.set(Buffer.from(password), 1);
    return frame;
  },
    handleAuthResponse(data, callback) {
  const blockTime =
    (data[3] | (data[4] << 8) | (data[5] << 16) | (data[6] << 24)) / 1000;
  const result = {
    fail: data[1] === 1,
    remainingAttempts: data[2],
    remainingBlockTime: parseInt(blockTime, 10),
  };

  if (!result.fail && client.writable) {
    client.write(Buffer.from([1]));
  }
  callback(result);
},

handleData: (data, callback) => {
  switch (data[0]) {
    case config.CIE_commands.SET_GATEWAY_AUTH_ETH:
      Controller.handleAuthResponse(data, callback);
      break;
    case config.CIE_commands.PING:
      Controller.handlePingResponse(data);
      break;
    default:
      Controller.CommunicationHandler(data, config.connectionsMode.NETWORK);
      break;
  }
},
  handlePingResponse(data) {
  Controller.setIsConfigurationUpdating(false);
  if (Controller.commandReceived === false) {
    Controller.callbackWriteWebsoket({
      event: "timeout_config",
      command: { data },
    });
  }
  Controller.commandReceived = true;
  Controller.CommunicationHandler(data, config.connectionsMode.NETWORK);
},
authenticateGateway: (data, callback) => {
  connectionLock = connectionLock.then(() => {
    return new Promise((resolve, reject) => {
      if (client) client.end();

      client = new net.Socket();

      client.connect(config.DEFAULT_TCP_PORT, data.ip, () => {
        const frame = Controller.createAuthFrame(Buffer.from(data.password));
        if (client.writable) {
          client.write(frame);
        }
      });

      client.on("data", (data) => {
        Controller.handleData(data, callback);
        resolve();
      });

      client.on("error", (err) => {
        console.error("Connection error:", err);
        callback({ fail: true, error: err.message });
        resolve();
        //if (client) {
        //  client.end();
        //}
        //Controller.stopUsbCommunication();
      });

      client.on("end", () => {
        //console.log("Disconnected from GW");
        resolve();
      });

      client.on("close", (hadError) => {
        if (hadError) {
          console.error("Connection closed due to error.");
        } else {
          //console.log("Connection closed correcty.");
        }
        resolve();
      });
    });
  });
},
  sendFn: undefined,
    setIsConfigurationUpdatingExternalFunction: () => { },
      setIsConfigurationUpdating: (value) => {
        configurationUpdating = value;
        Controller.setIsConfigurationUpdatingExternalFunction(value);
      },
        setSendFunction: function (fn) {
          Controller.sendFn = fn;
        },
setCallbackFunction: function (fn) {
  Controller.callbackWriteWebsoket = fn;
},
setCallbackProcessLogs: function (fn) {
  Controller.callbackProcessLogs = fn;
},
};
function writeToCIE(command, logInfo) {
  //console.log(">> " + (logInfo || ""));
  //console.log(">> " + Array.from(command).toString());
  // fs.writeFileSync("log.txt", ">> " + Array.from(command).toString() + "\n", {
  //     flag: "a",
  // });
  if (Controller.sendFn) {
    Controller.sendFn(command);
  } else {
    //console.log("Não tem Controller.sendFn");
  }
}

function verifyGatewayCertsSendControl() {
  certificatesControl = {
    root_ca: "none",
    self_ca: "none",
    self_ca_pk: "none",
  };
  for (var type in certificatesControl) {
    if (
      !parsedCertificatesFrames[type + "_file"] &&
      ((certificatesInfo[type] && !certificatesInfo[type].numeroSerie) ||
        !certificatesInfo[type])
    ) {
      certificatesControl[type] = "remove";
    } else if (parsedCertificatesFrames[type + "_file"]) {
      certificatesControl[type] = "update";
    }
  }
}

function gatewayCertsSend() {
  var removeCommand = {
    root_ca: 0,
    self_ca: 1,
    self_ca_pk: 2,
  };
  frameControl = 0;
  for (var type in certificatesControl) {
    if (certificatesControl[type] === "update") {
      writeToCIE(parsedCertificatesFrames[type + "_file"].lengthFrame.data);
      return;
    }
    if (certificatesControl[type] === "remove") {
      writeToCIE(
        [0, CIE_commands.PROG_DEL_SSLTLS, removeCommand[type]],
        "PROG_DEL_SSLTLS"
      );
      return;
    }
  }
  obj = { event: "send_configuration", data: { success: true } };
  Controller.setIsConfigurationUpdating(false);
}

function sendCertificateFrames(certificateType, frame) {
  const certificateFrames = parsedCertificatesFrames[certificateType + "_file"];
  if (frame[1] === 0 || frame[1] === 2) {
    if (frame[2] === 0) {
      if (frameControl < certificateFrames.frames.length) {
        writeToCIE(
          Array.from(certificateFrames.frames[frameControl].data),
          "CERTIFICADO " +
          frameControl +
          " de " +
          certificateFrames.frames.length
        );
        frameControl++;
      } else {
        writeToCIE(Array.from(certificateFrames.crc.data), "CRC");
      }
    } else {
      obj = { event: "send_configuration", data: { success: false } };
      Controller.setIsConfigurationUpdating(false);
    }
  } else if (frame[1] === 1) {
    const crcValidation = Buffer.from(frame.slice(3, 7)).readUInt32LE();
    if (frame[2] === 0 && crcValidation === 0) {
      frameControl = 0;
      certificatesControl[certificateType] = "sent";
      gatewayCertsSend();
    } else {
      obj = {
        event: "send_configuration",
        data: { success: false, error: certificateType },
      };
      Controller.setIsConfigurationUpdating(false);
    }
  }
}

//trata exceções das configurações
function exeptionsHandle(config) {
  //exceções dos eventos de btn de alarme e btn de brigada serem adicionados na regra que possui essas opcoes habilitadas
  config.regras = Controller.verifyRulesLoopZero(config.regras, "add");
  //envia somente os dispositivos do laco 0 que estao em uso (os que possuem mascara)
  config.lacos[0].dispositivos = virtualLoopClean(config.lacos[0], config);

  return config;
}

//trata o laco 0, envia para a central somente os dispositivos que foram recebidos, ou dispositivos
//que foram utilizados no sistema (que possuem mascara de bits das regras)
function virtualLoopClean(virtualLoop, configuration) {
  var virtualLoopClean = {};
  // var virtualLoopReceived = config.virtualLoop;

  for (var id in virtualLoop.dispositivos) {
    var ruleMask = parseConfig.getItemRules(
      "dispositivo",
      configuration.regras,
      0,
      id
    );
    // if(!ruleMask.empty || typeof virtualLoopReceived[id] !== 'undefined') {
    if (
      !ruleMask.empty ||
      virtualLoop.dispositivos[id].saida_padrao ||
      config.dispositivos_locais.indexOf(id) != -1
    ) {
      virtualLoopClean[id] = virtualLoop.dispositivos[id];
      virtualLoopClean[id].ruleMask = ruleMask.ruleMask;
    }
  }

  return virtualLoopClean;
}

module.exports = Controller;
