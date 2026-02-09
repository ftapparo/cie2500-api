/**
 * Criado por Livecom on 3/19/2016.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

let config = require("./config")();
const crcLib = require("crc");
const bitwise = require("bitwise");
const netModule = require("net");
const CRCUtils = require("./crcUtils");

modelos_centrais = Object.keys(config.modelos_centrais);
var centralVersion;
var centralModel;

module.exports = {
  unparseCIEModel: function (frame, callback) {
    var con_json = {};
    var model = frame[1];
    if (model == 0) {
      con_json.error = true;
    } else {
      con_json.model = modelos_centrais[model];
    }
    con_json.version = frame[2] + "." + frame[3] + "." + frame[4];

    //modo desenvolvedor
    if (frame[5] === 41) {
      con_json.developerMode = true;
    }

    callback(con_json);

    centralModel = con_json.model;
    centralVersion = parseInt(con_json.version.replace(/\D/g, ""));

    if (con_json.model === "GATEWAY") {
      config = require("./config")("3.1.0");
    } else {
      config = require("./config")(con_json.version);
    }
  },

  parseMacAddress: function (frame) {
    var mac = "";
    try {
      for (var index = 1; index < 7; index++) {
        mac += ("00" + frame[index].toString(16)).slice(-2) + ":";
      }
      mac = mac.substring(0, mac.length - 1).toUpperCase();
    } catch (e) {
      return mac;
    }
    return mac;
  },

  loopConfig: function (loops, callback) {
    var frameIndex = 1;
    var frameLength = 0;
    var frame = [];
    frame[0] = 0;
    frame[config.loop.config] = 33;

    //envia a partir do laco 1
    for (var i = 0; i < loops.length - 1; i++) {
      frame[config.loop.id + i * config.loop.offset] = i + 1;
      frame[config.loop.blocked + i * config.loop.offset] = loops[i + 1]
        .habilitado
        ? 0
        : 1;
    }
    frame[129] = frameIndex;
    frame[130] = frameLength;
    frame = CRCUtils.concatCRC(frame);
    callback(frame);
  },

  getItemRules: function (tipo, regras, laco, endereco) {
    var empty = true;
    var ruleMask = [].repeat(0, config.device.rule_mask_length);
    for (var idRegra in regras) {
      var itens = regras[idRegra].itens;
      var regraInt = parseInt(idRegra) - 1;
      for (var idItem in itens) {
        var item = itens[idItem];
        if (
          item.modo == "entrada" &&
          (((tipo == "dispositivo" ||
            tipo == "evento" ||
            tipo == "interligacao") &&
            item.laco == laco &&
            item.endereco == endereco) ||
            (tipo == "zona" && item.id == endereco))
        ) {
          var position = parseInt(regraInt / 8);
          var bit = regraInt % 8;
          ruleMask[position] = ruleMask[position] | (1 << bit);
          empty = false;
        }
      }
    }
    return { empty: empty, ruleMask: ruleMask };
  },

  devicesConfig: function (loops, rules, callback) {
    var frameIndex = 0;
    var frameLength = 0;
    var frames = [];
    var ruleMask;
    for (var i = 0; i < loops.length; i++) {
      var loop = loops[i].dispositivos;
      var j = 0;
      var keys = Object.keys(loop);
      frameLength = Math.ceil(keys.length / config.device.qty);
      frameIndex = 1;
      while (j < keys.length) {
        var frame = [];
        frame[0] = 0;
        frame[config.device.config] = 2;
        frame[config.device.end_config] = 0;
        frame[config.device.loop] = i;
        for (var w = 0; w < config.device.qty; w++) {
          if (j + w < keys.length) {
            frame[config.device.address + w * [config.device.offset]] =
              loop[keys[j + w]].endereco;
            frame[config.device.subtype + w * [config.device.offset]] =
              parseInt(loop[keys[j + w]].subtipo);
            frame[config.device.type + w * [config.device.offset]] = parseInt(
              loop[keys[j + w]].tipo
            );
            frame[config.device.zone + w * [config.device.offset]] = parseInt(
              loop[keys[j + w]].zona
            );
            frame[config.device.enable + w * [config.device.offset]] = loop[
              keys[j + w]
            ].habilitado
              ? 1
              : 0;

            if (i == 0) {
              frame[config.device.supervision + w * [config.device.offset]] = 0;
              ruleMask = loop[keys[j + w]].ruleMask;
            } else {
              frame[config.device.type + w * [config.device.offset]] = parseInt(
                loop[keys[j + w]].tipo
              );
              frame[config.device.supervision + w * [config.device.offset]] =
                loop[keys[j + w]].supervisao ? 1 : 0;
              ruleMask = this.getItemRules(
                "dispositivo",
                rules,
                i,
                loop[keys[j + w]].endereco
              ).ruleMask;
            }

            for (var k = 0; k < config.device.name_length; k++) {
              frame[config.device.name_start + k + w * [config.device.offset]] =
                loop[keys[j + w]].nome.charCodeAt(k);
            }

            for (k = 0; k < config.device.rule_mask_length; k++) {
              frame[config.device.rule_mask + k + w * [config.device.offset]] =
                ruleMask[k];
            }

            if (j + w + 1 == keys.length) {
              frame[config.device.end_config] = 1;
            }
          } else {
            frame[config.device.end_config] = 1;
          }
        }
        frame[129] = frameIndex;
        frame[130] = frameLength;
        frameIndex++;
        frame = CRCUtils.concatCRC(frame);
        frames.push(frame);
        j = j + config.device.qty;
      }
    }
    callback(frames);
  },

  unparseLoopConfig: function (frame, callback) {
    var loopConfig = [{ dispositivos: {}, habilitado: true }];
    for (var i = 0; i < config.loop.qty; i++) {
      loop = { dispositivos: {} };
      loop.habilitado =
        frame[config.loop.blocked - 1 + i * config.loop.offset] == 0;
      loopConfig.push(loop);
    }
    callback(loopConfig);
  },

  unparseLoopScanConfig: function (frame, initId, callback) {
    var deviceConfig = {};
    deviceConfig.loop = frame[config.loop_scan.loop - 1];
    deviceConfig.devices = {};
    for (var i = 1; i <= frame[3]; i++) {
      deviceConfig.devices[initId + i] = frame[i + 3];
    }
    callback(deviceConfig);
  },

  unparseDeviceConfig: function (frame, callback) {
    var deviceConfig = {};
    deviceConfig.loop = frame[config.device.loop - 1];
    deviceConfig.devices = {};

    for (var i = 0; i < config.device.qty; i++) {
      if (frame[config.device.address - 1 + i * config.device.offset] != 0) {
        var device = {};
        device.laco = deviceConfig.loop;
        device.endereco =
          frame[config.device.address + i * config.device.offset - 1];
        device.tipo = frame[config.device.type + i * config.device.offset - 1];
        device.subtipo =
          frame[config.device.subtype + i * config.device.offset - 1];
        device.zona = frame[config.device.zone + i * config.device.offset - 1];
        device.supervisao =
          frame[config.device.supervision + i * config.device.offset - 1] == 1;
        device.habilitado =
          frame[config.device.enable + i * config.device.offset - 1] == 0;

        var array_name = frame.slice(
          config.device.name_start - 1 + i * config.device.offset,
          config.device.name_start -
            1 +
            i * config.device.offset +
            config.device.name_length
        );

        device.nome = "";
        for (var k = 0; k < array_name.length; k++) {
          if (array_name[k]) device.nome += String.fromCharCode(array_name[k]);
        }

        deviceConfig.devices[device.endereco] = device;
      }
    }
    callback(deviceConfig);
  },

  parseZoneConfig: function (zones, rules, callback) {
    var frameIndex = 0;
    var frameLength = 0;
    var frames = [];
    var j = 0;
    var keys = Object.keys(zones);
    while (j < keys.length) {
      var frame = [];
      frame[0] = 0;
      frame[config.zone.config] = 5;
      frame[config.zone.end_config] = 0;

      frameLength = Math.ceil(keys.length / config.zone.qty);

      for (var w = 0; w < config.zone.qty; w++) {
        if (j + w < keys.length) {
          frame[config.zone.id + w * [config.zone.offset]] =
            zones[keys[j + w]].id;
          frame[config.zone.enable + w * [config.zone.offset]] = zones[
            keys[j + w]
          ].habilitado
            ? 1
            : 0;
          for (var k = 0; k < config.zone.name_length; k++) {
            frame[config.zone.name_start + k + w * [config.zone.offset]] =
              zones[keys[j + w]].nome.charCodeAt(k);
          }
          var ruleMask = this.getItemRules(
            "zona",
            rules,
            0,
            zones[keys[j + w]].id
          ).ruleMask;
          for (k = 0; k < config.zone.rule_mask_length; k++) {
            frame[config.zone.rule_mask + k + w * [config.zone.offset]] =
              ruleMask[k];
          }
          if (j + w + 1 == keys.length) {
            frame[config.rule.end_config] = 1;
            frameIndex++;
          }
        } else {
          frame[config.zone.end_config] = 1;
        }
      }
      frame[129] = frameIndex;
      frame[130] = frameLength;
      frame = CRCUtils.concatCRC(frame);
      frames.push(frame);
      j = j + config.zone.qty;
    }
    callback(frames);
  },

  unparseZoneConfig: function (frame, callback) {
    var zoneConfig = {};
    zoneConfig.zones = {};

    for (var i = 0; i < config.zone.qty; i++) {
      if (frame[config.zone.name_start - 1 + i * config.zone.offset] != 0) {
        var zone = {};
        zone.id = frame[config.zone.id + i * config.zone.offset - 1];
        zone.habilitado =
          frame[config.zone.enable + i * config.zone.offset - 1] == 1;

        var array_name = frame.slice(
          config.zone.name_start - 1 + i * config.zone.offset,
          config.zone.name_start -
            1 +
            i * config.zone.offset +
            config.zone.name_length
        );

        zone.nome = "";
        for (var k = 0; k < array_name.length; k++) {
          if (array_name[k]) zone.nome += String.fromCharCode(array_name[k]);
        }

        zoneConfig.zones[zone.id] = zone;
      }
    }
    callback(zoneConfig);
  },

  parseRuleConfig: function (rules, callback) {
    var frameIndex = 0;
    var frameLength = 0;
    var frames = [];
    var j = 0;
    var keys = Object.keys(rules);
    while (j < keys.length) {
      var frame = [];
      frame[0] = 0;
      frame[config.rule.config] = 7;
      frame[config.rule.end_config] = 0;
      frameLength = Math.ceil(keys.length / config.rule.qty);
      for (var w = 0; w < config.rule.qty; w++) {
        if (j + w < keys.length) {
          frame[config.rule.id + w * [config.rule.offset]] =
            rules[keys[j + w]].id;
          frame[config.rule.enable + w * [config.rule.offset]] = rules[
            keys[j + w]
          ].habilitado
            ? 1
            : 0;
          frame[config.rule.rule_type + w * [config.rule.offset]] =
            rules[keys[j + w]].tipo == "sinalizacao" ? 0 : 1; //ou atuacao

          var min,
            sec,
            ativacao_saida = rules[keys[j + w]].ativacao_saida;

          if (ativacao_saida == "imediata") {
            min = 0;
            sec = 0;
          } else {
            min = parseInt(rules[keys[j + w]].temporizacao.split(":")[0]);
            sec = parseInt(rules[keys[j + w]].temporizacao.split(":")[1]);
          }

          frame[config.rule.minutes + w * [config.rule.offset]] = min;
          frame[config.rule.seconds + w * [config.rule.offset]] = sec;
          frame[config.rule.input_condition + w * [config.rule.offset]] =
            rules[keys[j + w]].condicao_entrada == "unica" ? 0 : 1; //ou dupla
          frame[config.rule.activation_output + w * [config.rule.offset]] =
            rules[keys[j + w]].ativacao_saida == "imediata" ? 0 : 1; //ou temporizada
          frame[config.rule.brigade + w * [config.rule.offset]] = rules[
            keys[j + w]
          ].brigada
            ? 1
            : 0;
          frame[config.rule.alarm + w * [config.rule.offset]] = rules[
            keys[j + w]
          ].alarme
            ? 1
            : 0;
          frame[config.rule.items_count_byte1 + w * [config.rule.offset]] =
            rules[keys[j + w]].itens.length >>> 8;
          frame[config.rule.items_count_byte2 + w * [config.rule.offset]] =
            rules[keys[j + w]].itens.length & 255;
          frame[config.rule.cancelable + w * [config.rule.offset]] = rules[
            keys[j + w]
          ].cancelavel
            ? 1
            : 0;
          for (var k = 0; k < config.rule.name_length; k++) {
            frame[config.rule.name_start + k + w * [config.rule.offset]] =
              rules[keys[j + w]].nome.charCodeAt(k);
          }
          if (j + w + 1 == keys.length) {
            frameIndex++;
            frame[config.rule.end_config] = 1;
          }
        } else {
          frame[config.rule.end_config] = 1;
          frameIndex = 0;
        }
      }
      frame[129] = frameIndex;
      frame[130] = frameLength;
      frame = CRCUtils.concatCRC(frame);
      frames.push(frame);
      j = j + config.rule.qty;
    }
    callback(frames);
  },

  unparseRuleConfig: function (frame, callback) {
    var ruleConfig = { rules: {} };

    for (var i = 0; i < config.rule.qty; i++) {
      if (frame[config.rule.name_start - 1 + i * config.rule.offset] != 0) {
        var rule = {};
        rule.id = frame[config.rule.id + i * config.rule.offset - 1];
        rule.habilitado =
          frame[config.rule.enable + i * config.rule.offset - 1] == 1;
        var array_name = frame.slice(
          config.rule.name_start - 1 + i * config.rule.offset,
          config.rule.name_start -
            1 +
            i * config.rule.offset +
            config.rule.name_length
        );

        rule.nome = "";
        for (var k = 0; k < array_name.length; k++) {
          if (array_name[k]) rule.nome += String.fromCharCode(array_name[k]);
        }

        rule.tipo_regra =
          frame[config.rule.rule_type + i * config.rule.offset - 1] == "0"
            ? "sinalizacao"
            : "atuacao";
        var min = (
          "00" + frame[config.rule.minutes + i * config.rule.offset - 1]
        ).slice(-2);
        var sec = (
          "00" + frame[config.rule.seconds + i * config.rule.offset - 1]
        ).slice(-2);
        rule.temporizacao = min + ":" + sec;
        rule.condicao_entrada =
          frame[config.rule.input_condition + i * config.rule.offset - 1] == "0"
            ? "unica"
            : "dupla";
        rule.ativacao_saida =
          frame[config.rule.activation_output + i * config.rule.offset - 1] ==
          "0"
            ? "imediata"
            : "temporizada";
        rule.brigada =
          frame[config.rule.brigade + i * config.rule.offset - 1] == 1;
        rule.alarme =
          frame[config.rule.alarm + i * config.rule.offset - 1] == 1;
        rule.cancelavel =
          frame[config.rule.cancelable + i * config.rule.offset - 1] == 1;
        rule.temporizador == "00:00"
          ? (rule.modo_disparo = "imediato")
          : (rule.modo_disparo = "retardo");
        ruleConfig.rules[rule.id] = rule;
      }
    }
    callback(ruleConfig);
  },

  parseRuleItemConfig: function (rules, callback) {
    var frameIndex = 0;
    var frameLength = 0;
    var frames = [];
    var current_rule = 0;
    var rule_keys = Object.keys(rules);
    while (current_rule < rule_keys.length) {
      var j = 0;
      var items_of_rule = rules[rule_keys[current_rule]].itens;
      frameLength = Math.ceil(items_of_rule.length / config.rule_items.qty);
      frameIndex = 1;
      while (j < items_of_rule.length) {
        var frame = [];
        var item_type;
        frame[0] = 0;
        frame[config.rule.config] = 8;
        frame[config.rule.end_config] = 0;
        frame[config.rule_items.rule_id] = rules[rule_keys[current_rule]].id;
        for (var w = 0; w < config.rule_items.qty; w++) {
          if (j + w < items_of_rule.length) {
            frame[
              config.rule_items.item_mode + w * [config.rule_items.offset]
            ] = items_of_rule[j + w].modo == "saida" ? 1 : 0;
            frame[
              config.rule_items.board_number + w * [config.rule_items.offset]
            ] = 0;

            item_type = items_of_rule[j + w].tipo;
            if (
              item_type == "dispositivo" ||
              item_type == "evento" ||
              item_type == "interligacao"
            ) {
              frame[
                config.rule_items.item_class + w * [config.rule_items.offset]
              ] = 0;
              frame[
                config.rule_items.item_id + w * [config.rule_items.offset]
              ] = items_of_rule[j + w].endereco;
            } else if (item_type == "zona") {
              frame[
                config.rule_items.item_class + w * [config.rule_items.offset]
              ] = 1;
              frame[
                config.rule_items.item_id + w * [config.rule_items.offset]
              ] = items_of_rule[j + w].id;
            }

            if (
              item_type == "zona" ||
              item_type == "evento" ||
              item_type == "interligacao"
            ) {
              frame[
                config.rule_items.item_loop + w * [config.rule_items.offset]
              ] = 0;
            } else if (item_type == "dispositivo") {
              frame[
                config.rule_items.item_loop + w * [config.rule_items.offset]
              ] = items_of_rule[j + w].laco;
            }
            if (j + w + 1 == items_of_rule.length) {
              frame[config.rule.end_config] = 1;
            }
          } else {
            frame[frame.length] = 0xff;
            frame[config.rule.end_config] = 1;
            break;
          }
        }
        frame[129] = frameIndex++;
        frame[130] = frameLength;
        frame = CRCUtils.concatCRC(frame);
        frames.push(frame);
        j = j + config.rule_items.qty;
      }
      current_rule++;
    }
    callback(frames);
  },

  unparseRuleItemConfig: function (frame, callback) {
    var ruleItemConfig = {
      items: [],
      rule_id: frame[config.rule_items.rule_id - 1],
    };

    for (var i = 0; i < config.rule_items.qty; i++) {
      var id =
        frame[config.rule_items.item_id + i * config.rule_items.offset - 1];
      if (!id) continue;

      //POSICAO_ITEM_MODO -- 1 = zona; 0 = dispositivo
      if (
        frame[
          config.rule_items.item_class - 1 + i * config.rule_items.offset
        ] == 1
      ) {
        var rule_item = {};
        rule_item.id = id;
        rule_item.tipo = "zona";
        rule_item.modo =
          frame[
            config.rule_items.item_mode + i * config.rule_items.offset - 1
          ] == 1
            ? "saida"
            : "entrada";
        ruleItemConfig.items.push(rule_item);
      } else if (
        frame[config.rule_items.item_id - 1 + i * config.rule_items.offset] !=
          0 &&
        frame[config.rule_items.item_id - 1 + i * config.rule_items.offset] !=
          undefined
      ) {
        var rule_item = {};

        //se o laco for diferente de zero ou for um dispositivo local = é um dispositivo
        if (
          frame[
            config.rule_items.item_loop - 1 + i * config.rule_items.offset
          ] != 0 ||
          config.dispositivos_locais.indexOf(id + "") != -1
        ) {
          rule_item.tipo = "dispositivo";
          rule_item.laco =
            frame[
              config.rule_items.item_loop + i * config.rule_items.offset - 1
            ];

          //senão é um evento ou um evento de interligacao
        } else {
          if (config.entradas_interligacao.indexOf(id) === -1) {
            rule_item.tipo = "evento";
          } else {
            rule_item.tipo = "interligacao";
          }
          rule_item.laco = 0;
        }
        rule_item.modo =
          frame[
            config.rule_items.item_mode + i * config.rule_items.offset - 1
          ] == 1
            ? "saida"
            : "entrada";
        rule_item.endereco = id;
        ruleItemConfig.items.push(rule_item);
      }
    }
    callback(ruleItemConfig);
  },

  parseCREConfig: function (system, callback) {
    var frame = [];

    for (var i = 0; i < 128; i++) frame[i] = 0;

    frame[0] = 0;
    frame[config.system.config] = 44; //SEND_CRE_CONFIG;
    frame[config.system.end_config] = 1;

    for (var k = 0; k < config.system.installation_length; k++) {
      frame[config.system.installation + k] =
        system.local_instalacao.charCodeAt(k);
    }
    for (var index = 2; index < 5; index++) {
      var field = "password_" + index;
      var json_field = "senha_" + index;
      for (var k = 0; k < config.system.password_length; k++) {
        frame[config.system[field] + k] = system[json_field].charCodeAt(k) || 0;
      }
    }

    frame[config.system.delay_min] = parseInt(system.retardo.split(":")[0]);
    frame[config.system.delay_sec] = parseInt(system.retardo.split(":")[1]);

    if (system.repetidora.endereco) {
      frame[config.system.cre_id] = parseInt(system.repetidora.endereco) - 1;
    }

    callback(frame);
  },

  parseGatewayAdvancedCommands: function (data, callback) {
    if (data.step === 1) {
      var frame = new Uint8Array(128);
      frame[1] = config.CIE_commands.SET_GATEWAY_ADVANCED_CMDS;
      frame[2] = 2;
      var contraSenha = new Buffer.alloc(4);
      contraSenha.writeUInt32LE(data.contraSenha);
      frame.set(contraSenha, 3);
      return frame;
    } else {
      return [0, config.CIE_commands.SET_GATEWAY_ADVANCED_CMDS, 0];
    }
  },

  parseGatewayMac: function (mac) {
    var frame = new Uint8Array(128);
    frame[1] = config.CIE_commands.SET_GATEWAY_MAC;
    var hex = mac.split(":");
    for (var i = 0; i < 6; i++) {
      frame[i + 2] = parseInt(Number("0x" + hex[i]), 10);
    }
    return frame;
  },

  parseGatewayConfig: function (data, callback) {
    var frames = [];

    var frameRede = new Uint8Array(128);
    frameRede[1] = config.CIE_commands.SET_GATEWAY_INFO;
    frameRede[config.gateway.rede.modo_ip] = data.sistema.rede.dhcp ? 1 : 0;
    frameRede[config.gateway.rede.tipo_integracao] =
      config.tipo_integracao_values[data.gateway.integracao];
    frameRede[config.gateway.rede.is_ipv6] = data.sistema.rede.ipv6 ? 1 : 0;

    var split = data.sistema.rede.ip.split(".");
    if (split.length === 4) {
      for (let index = 0; index < 4; index++) {
        frameRede[config.gateway.rede.ip_fixo + index] = parseInt(split[index]);
      }
    }

    split = data.sistema.rede.mascara.split(".");
    if (split.length === 4) {
      for (let index = 0; index < 4; index++) {
        frameRede[config.gateway.rede.net_mask + index] = parseInt(
          split[index]
        );
      }
    }

    split = data.sistema.rede.gateway.split(".");
    if (split.length === 4) {
      for (let index = 0; index < 4; index++) {
        frameRede[config.gateway.rede.gateway + index] = parseInt(split[index]);
      }
    }

    const pwProgCie = new Buffer.from(data.sistema.pwd_prog_cie, "utf-8");
    frameRede.set(pwProgCie, config.gateway.rede.pwd_prog_cie);

    frames.push(frameRede);

    var frameModbus = new Uint8Array(128);
    frameModbus[1] = config.CIE_commands.SET_MODBUS_INFO;
    let port = new Buffer.alloc(2);
    port.writeUInt16LE(data.gateway.modbusTCP.porta, 0);
    frameModbus.set(port, config.gateway.modbus.porta);
    frameModbus[config.gateway.modbus.unity_id] = data.gateway.modbusTCP.unitID;
    let clientTimeout = new Buffer.alloc(2);
    clientTimeout.writeUInt16LE(minSecToInt(data.gateway.modbusTCP.timeout), 0);
    frameModbus.set(clientTimeout, config.gateway.modbus.client_timeout);
    frames.push(frameModbus);

    // common bytes between rcptip and situator
    let codigoConta = new Buffer.alloc(4);

    var frameSituador = new Uint8Array(128);
    frameSituador[1] = config.CIE_commands.SET_PROG_SITUATOR_INFO;

    codigoConta.writeUInt32LE(data.gateway.situador.codigoConta, 0);
    frameSituador.set(codigoConta, config.gateway.situador.account_code);

    frameSituador[config.gateway.situador.auth_by] =
      data.gateway.situador.autenticacao === "login" ? 0 : 1;
    var codigoZona = Buffer.from(
      trimNull(data.gateway.situador.codigoZona),
      "utf-8"
    );
    frameSituador.set(codigoZona, config.gateway.situador.zone_code);
    frameSituador[config.gateway.situador.Language] =
      data.gateway.situador.idioma === "pt" ? 0 : 1;
    frames.push(frameSituador);

    var frameSituadorLogin = new Uint8Array(128);
    frameSituadorLogin[1] = config.CIE_commands.SET_SITUATOR_LOGIN;
    const user = Buffer.from(trimNull(data.gateway.situador.usuario), "utf-8");
    frameSituadorLogin.set(user, config.gateway.situador_login.user);
    const pass = Buffer.from(trimNull(data.gateway.situador.senha), "utf-8");
    frameSituadorLogin.set(pass, config.gateway.situador_login.password);
    frames.push(frameSituadorLogin);

    var frameSituadorToken = new Uint8Array(128);
    frameSituadorToken[1] = config.CIE_commands.SET_SITUATOR_TOKEN;
    const token = Buffer.from(trimNull(data.gateway.situador.token), "utf-8");
    frameSituadorToken.set(token, config.gateway.situador_token.token);
    frames.push(frameSituadorToken);

    var frameSituadorHost = new Uint8Array(128);
    frameSituadorHost[1] = config.CIE_commands.SET_SITUATOR_HOST;
    frameSituadorHost[config.gateway.situador_host.is_https] = data.gateway
      .situador.https
      ? 1
      : 0;
    port = new Buffer.alloc(2);
    port.writeUInt16LE(data.gateway.situador.porta, 0);
    frameSituadorHost.set(port, config.gateway.situador_host.port);
    if (isIpAddress(trimNull(data.gateway.situador.host))) {
      split = trimNull(data.gateway.situador.host).split(".");
      if (split.length === 4) {
        for (let index = 0; index < 4; index++) {
          frameSituadorHost[config.gateway.situador_host.hostname + index] =
            parseInt(split[index]);
        }
      }
      frameSituadorHost[config.gateway.situador_host.is_host_ip] = 1;
    } else {
      const hostname = Buffer.from(
        trimNull(data.gateway.situador.host),
        "utf-8"
      );
      frameSituadorHost.set(hostname, config.gateway.situador_host.hostname);
      frameSituadorHost[config.gateway.situador_host.is_host_ip] = 0;
    }
    frames.push(frameSituadorHost);

    // common bytes between webhook and rcptip
    let heartbeat = new Buffer.alloc(4);
    let userCode = new Buffer.alloc(4);
    let intervaloEventos = new Buffer.alloc(2);

    var frameWebhookInfo = new Uint8Array(128);
    frameWebhookInfo[1] = config.CIE_commands.SET_WEBHOOK_INFO;
    intervaloEventos.writeUInt16LE(data.gateway.webhook.intervaloEventos, 0);
    frameWebhookInfo.set(
      intervaloEventos,
      config.gateway.webhook_info.TempoEntreEventos
    );
    heartbeat.writeUInt32LE(
      minSecToMilliseconds(data.gateway.webhook.heartbeat)
    );
    frameWebhookInfo.set(heartbeat, config.gateway.webhook_info.HeartbeatTime);
    userCode.writeUInt32LE(data.gateway.webhook.codigoEquipamento, 0);
    frameWebhookInfo.set(userCode, config.gateway.webhook_info.UserCode);
    frameWebhookInfo[config.gateway.webhook_info.Language] =
      data.gateway.webhook.idioma === "pt" ? 0 : 1;
    frames.push(frameWebhookInfo);

    var frameWebhookHmacPK = new Uint8Array(128);
    frameWebhookHmacPK[1] = config.CIE_commands.SET_WEBHOOK_HMAC_PRIVKEY;
    var hexString = Buffer.from(data.gateway.webhook.chavePrivada, "base64");
    frameWebhookHmacPK.set(hexString, config.gateway.hmac_pk.pkKey);
    frames.push(frameWebhookHmacPK);

    var webhookHost = new Uint8Array(128);
    webhookHost[1] = config.CIE_commands.SET_WEBHOOK_HOST;
    var isHttps = data.gateway.webhook.autenticacao !== "hmac";
    webhookHost[config.gateway.webhook_host.isHTTPs] = isHttps ? 1 : 0;
    var HttpsAuthType =
      data.gateway.webhook.nivelAutenticacao === "criptografia"
        ? 0
        : data.gateway.webhook.nivelAutenticacao === "opcional"
        ? 1
        : 2;
    webhookHost[config.gateway.webhook_host.HttpsAuthType] = HttpsAuthType;
    if (isIpAddress(trimNull(data.gateway.webhook.host))) {
      split = trimNull(data.gateway.webhook.host).split(".");
      if (split.length === 4) {
        for (let index = 0; index < 4; index++) {
          webhookHost[config.gateway.webhook_host.Host + index] = parseInt(
            split[index]
          );
        }
      }
      webhookHost[config.gateway.webhook_host.isHostIP] = 1;
    } else {
      const endpoint = data.gateway.webhook.host.split("/")[0];
      const hostnameBuffer = Buffer.from(trimNull(endpoint), "utf-8");
      webhookHost.set(hostnameBuffer, config.gateway.webhook_host.Host);
      webhookHost[config.gateway.webhook_host.isHostIP] = 0;
    }
    let portWebhook = new Buffer.alloc(2);
    portWebhook.writeUInt16LE(data.gateway.webhook.porta, 0);
    webhookHost.set(portWebhook, config.gateway.webhook_host.Porta);
    frames.push(webhookHost);

    var webhookEndpoint = new Uint8Array(128);
    webhookEndpoint[1] = config.CIE_commands.SET_WEBHOOK_ENDPOINT;
    var endpoint = "";
    if (data.gateway.webhook.host.length) {
      endpoint = data.gateway.webhook.host.split("/").slice(1).join("/");
      if (endpoint) {
        endpoint = "/" + endpoint;
        const endpointBuffer = Buffer.from(trimNull(endpoint), "utf-8");
        webhookEndpoint.set(
          endpointBuffer,
          config.gateway.webhook_endpoint.Endpoint
        );
      }
    }
    frames.push(webhookEndpoint);

    let rcptipInfo = new Buffer.alloc(128);
    rcptipInfo[1] = config.CIE_commands.SET_RCPTIP_INFO;
    userCode = new Buffer.alloc(4);
    codigoConta.writeUInt32LE(data.gateway.rcptip.codigoConta, 0);
    rcptipInfo.set(codigoConta, config.gateway.rcptip_info.AccountCode);
    userCode.writeUInt32LE(data.gateway.rcptip.identificadorEquipamento, 0);
    rcptipInfo.set(userCode, config.gateway.rcptip_info.UserCode);
    heartbeat = new Buffer.alloc(4);
    heartbeat.writeUInt32LE(
      minSecToMilliseconds(data.gateway.rcptip.heartbeat)
    );
    rcptipInfo.set(heartbeat, config.gateway.rcptip_info.HeartbeatTime);
    intervaloEventos = new Buffer.alloc(2);
    intervaloEventos.writeUInt16LE(data.gateway.rcptip.intervaloEventos, 0);
    rcptipInfo.set(
      intervaloEventos,
      config.gateway.rcptip_info.TempoEntreEventos
    );
    frames.push(rcptipInfo);

    let rcptipHost = new Buffer.alloc(128);
    rcptipHost[1] = config.CIE_commands.SET_RCPTIP_HOST;
    if (isIpAddress(trimNull(data.gateway.rcptip.host))) {
      split = trimNull(data.gateway.rcptip.host).split(".");
      if (split.length === 4) {
        for (let index = 0; index < 4; index++) {
          rcptipHost[config.gateway.rcptip_host.Host + index] = parseInt(
            split[index]
          );
        }
      }
      rcptipHost[config.gateway.rcptip_host.isHostIP] = 1;
    } else {
      const endpoint = data.gateway.rcptip.host.split("/")[0];
      const hostnameBuffer = Buffer.from(trimNull(endpoint), "utf-8");
      rcptipHost.set(hostnameBuffer, config.gateway.rcptip_host.Host);
      rcptipHost[config.gateway.rcptip_host.isHostIP] = 0;
    }
    let portRcptip = new Buffer.alloc(2);
    portRcptip.writeUInt16LE(data.gateway.rcptip.porta, 0);
    rcptipHost.set(portRcptip, config.gateway.rcptip_host.Porta);
    frames.push(rcptipHost);

    callback(
      frames,
      data.gateway.webhook.certificates_frames || {},
      data.gateway.certificates_info || {}
    );
  },

  unparseCREConfig: function (frame, callback) {
    var systemConfig = {};

    var array_site = frame.slice(
      config.system.installation - 1,
      config.system.installation - 1 + config.system.installation_length
    );

    systemConfig.local_instalacao = "";
    for (var i = 0; i < array_site.length; i++) {
      if (array_site[i])
        systemConfig.local_instalacao += String.fromCharCode(array_site[i]);
    }

    for (var index = 2; index < 5; index++) {
      var field = "password_" + index;
      var json_field = "senha_" + index;

      var array_pass = frame.slice(
        config.system[field] - 1,
        config.system[field] - 1 + config.system.password_length
      );
      var pass = "";
      for (var k = 0; k < config.system.password_length; k++) {
        if (array_pass[k] !== 0) pass += String.fromCharCode(array_pass[k]);
      }
      systemConfig[json_field] = pass;
    }

    var min, sec;

    if (frame[config.system.delay_min - 1] < 10) {
      min = "0" + frame[config.system.delay_min - 1];
    } else {
      min = frame[config.system.delay_min - 1];
    }

    if (frame[config.system.delay_sec - 1] < 10) {
      sec = "0" + frame[config.system.delay_sec - 1];
    } else {
      sec = frame[config.system.delay_sec - 1];
    }

    systemConfig.retardo = min + ":" + sec;
    systemConfig.repetidora = {
      endereco: frame[config.system.cre_id - 1] + 1,
    };

    systemConfig.rede = {};
    systemConfig.rede.dhcp = frame[config.system.dhcp - 1] === 1;
    systemConfig.rede.p2p = frame[config.system.p2p - 1] === 1;
    systemConfig.rede.ip =
      frame[config.system.ip - 1] +
      "." +
      frame[config.system.ip - 1 + 1] +
      "." +
      frame[config.system.ip - 1 + 2] +
      "." +
      frame[config.system.ip - 1 + 3];
    systemConfig.rede.mascara =
      frame[config.system.mask - 1] +
      "." +
      frame[config.system.mask - 1 + 1] +
      "." +
      frame[config.system.mask - 1 + 2] +
      "." +
      frame[config.system.mask - 1 + 3];
    systemConfig.rede.gateway =
      frame[config.system.gateway - 1] +
      "." +
      frame[config.system.gateway - 1 + 1] +
      "." +
      frame[config.system.gateway - 1 + 2] +
      "." +
      frame[config.system.gateway - 1 + 3];

    callback(systemConfig);
  },

  unparseGatewayConfig: function (frames, callback) {
    var gatewayConfig = { gateway: {}, rede: {}, sistema: {} };

    // common bytes between webhook and rcptip
    let heartbeat;

    for (const frame of frames) {
      switch (frame[0]) {
        case config.CIE_commands.GET_GATEWAY_INFO:
          gatewayConfig.rede = {};
          gatewayConfig.rede.dhcp =
            frame[config.gateway.rede.modo_ip - 1] === 1;
          gatewayConfig.gateway.integracao =
            config.tipo_integracao_types[
              frame[config.gateway.rede.tipo_integracao - 1]
            ];
          gatewayConfig.rede.ipv6 =
            frame[config.gateway.rede.is_ipv6 - 1] === 1;
          gatewayConfig.rede.ip =
            frame[config.gateway.rede.ip_fixo - 1] +
            "." +
            frame[config.gateway.rede.ip_fixo - 1 + 1] +
            "." +
            frame[config.gateway.rede.ip_fixo - 1 + 2] +
            "." +
            frame[config.gateway.rede.ip_fixo - 1 + 3];
          gatewayConfig.rede.mascara =
            frame[config.gateway.rede.net_mask - 1] +
            "." +
            frame[config.gateway.rede.net_mask - 1 + 1] +
            "." +
            frame[config.gateway.rede.net_mask - 1 + 2] +
            "." +
            frame[config.gateway.rede.net_mask - 1 + 3];
          gatewayConfig.rede.gateway =
            frame[config.gateway.rede.gateway - 1] +
            "." +
            frame[config.gateway.rede.gateway - 1 + 1] +
            "." +
            frame[config.gateway.rede.gateway - 1 + 2] +
            "." +
            frame[config.gateway.rede.gateway - 1 + 3];
          gatewayConfig.sistema.pwd_prog_cie = uintToString(
            frame,
            config.gateway.rede.pwd_prog_cie,
            20
          );
          break;

        case config.CIE_commands.GET_MODBUS_INFO:
          gatewayConfig.gateway.modbusTCP = {};
          gatewayConfig.gateway.modbusTCP.porta = read16(
            frame,
            config.gateway.modbus.porta
          );
          gatewayConfig.gateway.modbusTCP.unitID =
            frame[config.gateway.modbus.unity_id - 1];
          var timeout = read16(frame, config.gateway.modbus.client_timeout);
          gatewayConfig.gateway.modbusTCP.timeout = intToMinSec(timeout);
          break;

        case config.CIE_commands.GET_PROG_SITUATOR_INFO:
          gatewayConfig.gateway.situador = {};
          gatewayConfig.gateway.situador.codigoConta = read32(
            frame,
            config.gateway.situador.account_code
          );
          gatewayConfig.gateway.situador.autenticacao =
            frame[config.gateway.situador.auth_by - 1] === 0
              ? "login"
              : "token";
          gatewayConfig.gateway.situador.codigoZona = uintToString(
            frame,
            config.gateway.situador.zone_code,
            30
          );
          gatewayConfig.gateway.situador.idioma =
            frame[config.gateway.situador.Language - 1] === 0 ? "pt" : "es";
          break;

        case config.CIE_commands.GET_SITUATOR_LOGIN:
          gatewayConfig.gateway.situador.usuario = uintToString(
            frame,
            config.gateway.situador_login.user,
            48
          );
          gatewayConfig.gateway.situador.senha = uintToString(
            frame,
            config.gateway.situador_login.password,
            48
          );
          break;

        case config.CIE_commands.GET_SITUATOR_TOKEN:
          gatewayConfig.gateway.situador.token = uintToString(
            frame,
            config.gateway.situador_token.token,
            96
          );
          break;

        case config.CIE_commands.GET_SITUATOR_HOST:
          gatewayConfig.gateway.situador.https =
            frame[config.gateway.situador_host.is_https - 1] === 1;
          gatewayConfig.gateway.situador.porta = read16(
            frame,
            config.gateway.situador_host.port
          );

          if (frame[config.gateway.situador_host.is_host_ip - 1] === 0) {
            gatewayConfig.gateway.situador.host = uintToString(
              frame,
              config.gateway.situador_host.hostname,
              100
            );
          } else {
            gatewayConfig.gateway.situador.host =
              frame[config.gateway.situador_host.hostname - 1] +
              "." +
              frame[config.gateway.situador_host.hostname - 1 + 1] +
              "." +
              frame[config.gateway.situador_host.hostname - 1 + 2] +
              "." +
              frame[config.gateway.situador_host.hostname - 1 + 3];
          }
          break;

        case config.CIE_commands.GET_WEBHOOK_INFO:
          gatewayConfig.gateway.webhook = {};
          gatewayConfig.gateway.webhook.intervaloEventos = read16(
            frame,
            config.gateway.webhook_info.TempoEntreEventos
          );
          heartbeat = read32(frame, config.gateway.webhook_info.HeartbeatTime);
          gatewayConfig.gateway.webhook.heartbeat =
            millisecondsToMinSec(heartbeat);
          gatewayConfig.gateway.webhook.codigoEquipamento = read32(
            frame,
            config.gateway.webhook_info.UserCode
          );
          gatewayConfig.gateway.webhook.idioma =
            frame[config.gateway.webhook_info.Language - 1] === 0 ? "pt" : "es";
          break;

        case config.CIE_commands.GET_WEBHOOK_HMAC_PRIVKEY:
          gatewayConfig.gateway.webhook.chavePrivada = Buffer.from(
            frame.slice(
              config.gateway.hmac_pk.pkKey - 1,
              config.gateway.hmac_pk.pkKey + 64 - 1
            )
          ).toString("base64");
          break;

        case config.CIE_commands.GET_WEBHOOK_HOST:
          gatewayConfig.gateway.webhook.autenticacao =
            frame[config.gateway.webhook_host.isHTTPs - 1] === 0
              ? "hmac"
              : "https";
          gatewayConfig.gateway.webhook.nivelAutenticacao =
            frame[config.gateway.webhook_host.HttpsAuthType - 1] === 0
              ? "criptografia"
              : frame[config.gateway.webhook_host.HttpsAuthType - 1] === 1
              ? "opcional"
              : "obrigatoria";
          gatewayConfig.gateway.webhook.porta = read16(
            frame,
            config.gateway.webhook_host.Porta
          );
          if (frame[config.gateway.webhook_host.isHostIP - 1] === 0) {
            gatewayConfig.gateway.webhook.host = uintToString(
              frame,
              config.gateway.webhook_host.Host,
              100
            );
          } else {
            gatewayConfig.gateway.webhook.host =
              frame[config.gateway.webhook_host.Host - 1] +
              "." +
              frame[config.gateway.webhook_host.Host - 1 + 1] +
              "." +
              frame[config.gateway.webhook_host.Host - 1 + 2] +
              "." +
              frame[config.gateway.webhook_host.Host - 1 + 3];
          }
          break;

        case config.CIE_commands.GET_WEBHOOK_ENDPOINT:
          gatewayConfig.gateway.webhook.host += uintToString(
            frame,
            config.gateway.webhook_endpoint.Endpoint,
            100
          );
          break;

        case config.CIE_commands.GET_SSLTLS_ROOT_CA:
          gatewayConfig.gateway.certificates_info = {
            root_ca: {},
            self_ca: {},
            self_ca_pk: {},
          };
          var numeroSerieRoot = Buffer.from(
            frame.slice(
              config.gateway.certificate_info.serial_number - 1,
              config.gateway.certificate_info.serial_number + 16 - 1
            )
          )
            .toString("hex")
            .toUpperCase();
          if (numeroSerieRoot.replace(/0/g, "").length) {
            gatewayConfig.gateway.certificates_info.root_ca.validFrom =
              parseDateCertificate(
                frame,
                config.gateway.certificate_info.valid_from
              );
            gatewayConfig.gateway.certificates_info.root_ca.validTo =
              parseDateCertificate(
                frame,
                config.gateway.certificate_info.valid_to
              );
            gatewayConfig.gateway.certificates_info.root_ca.numeroSerie =
              numeroSerieRoot;
            gatewayConfig.gateway.certificates_info.root_ca.issuer =
              uintToString(frame, config.gateway.certificate_info.issuer, 40);
            gatewayConfig.gateway.certificates_info.root_ca.subject =
              uintToString(frame, config.gateway.certificate_info.subject, 40);
          }
          break;

        case config.CIE_commands.GET_RCPTIP_INFO:
          gatewayConfig.gateway.rcptip = {};
          gatewayConfig.gateway.rcptip.codigoConta = read32(
            frame,
            config.gateway.rcptip_info.AccountCode
          );
          gatewayConfig.gateway.rcptip.identificadorEquipamento = read32(
            frame,
            config.gateway.rcptip_info.UserCode
          );
          gatewayConfig.gateway.rcptip.intervaloEventos = read16(
            frame,
            config.gateway.rcptip_info.TempoEntreEventos
          );
          heartbeat = read32(frame, config.gateway.rcptip_info.HeartbeatTime);
          gatewayConfig.gateway.rcptip.heartbeat =
            millisecondsToMinSec(heartbeat);
          break;

        case config.CIE_commands.GET_RCPTIP_HOST:
          gatewayConfig.gateway.rcptip.porta = read16(
            frame,
            config.gateway.rcptip_host.Porta
          );
          if (frame[config.gateway.rcptip_host.isHostIP - 1] === 0) {
            gatewayConfig.gateway.rcptip.host = uintToString(
              frame,
              config.gateway.rcptip_host.Host,
              100
            );
          } else {
            gatewayConfig.gateway.rcptip.host =
              frame[config.gateway.rcptip_host.Host - 1] +
              "." +
              frame[config.gateway.rcptip_host.Host - 1 + 1] +
              "." +
              frame[config.gateway.rcptip_host.Host - 1 + 2] +
              "." +
              frame[config.gateway.rcptip_host.Host - 1 + 3];
          }
          break;

        case config.CIE_commands.GET_SSLTLS_SELF_CERT:
          var numeroSerieSelf = Buffer.from(
            frame.slice(
              config.gateway.certificate_info.serial_number - 1,
              config.gateway.certificate_info.serial_number + 16 - 1
            )
          )
            .toString("hex")
            .toUpperCase();
          if (numeroSerieSelf.replace(/0/g, "").length) {
            gatewayConfig.gateway.certificates_info.self_ca.validFrom =
              parseDateCertificate(
                frame,
                config.gateway.certificate_info.valid_from
              );
            gatewayConfig.gateway.certificates_info.self_ca.validTo =
              parseDateCertificate(
                frame,
                config.gateway.certificate_info.valid_to
              );
            gatewayConfig.gateway.certificates_info.self_ca.numeroSerie =
              numeroSerieSelf;
            gatewayConfig.gateway.certificates_info.self_ca.issuer =
              uintToString(frame, config.gateway.certificate_info.issuer, 40);
            gatewayConfig.gateway.certificates_info.self_ca.subject =
              uintToString(frame, config.gateway.certificate_info.subject, 40);
          }
          break;

        case config.CIE_commands.GET_SSLTLS_SELF_CERT_PK:
          var crcSelfPk = read32(frame, 2);
          if (crcSelfPk) {
            gatewayConfig.gateway.certificates_info.self_ca_pk.algoritmo =
              uintToString(frame, 8, 40);
            gatewayConfig.gateway.certificates_info.self_ca_pk.numeroSerie =
              crcSelfPk;
          }
          break;

        case config.CIE_commands.GET_GATEWAY_ERRORS:
          const errors = {};
          for (var errorType in config.gateway.errors) {
            if (!errors[errorType]) errors[errorType] = [];
            for (var bit = 0; bit < 9; bit++) {
              if (getBit(frame[config.gateway.errors[errorType] - 1], bit)) {
                errors[errorType].push("gtw-erro-" + errorType + "-" + bit);
              }
            }
          }
          gatewayConfig.errors = errors;
          break;

        case config.CIE_commands.SET_GATEWAY_ADVANCED_CMDS:
          if (frame[1] === 1) {
            gatewayConfig.contraSenha = read32(frame, 3);
          }
          if (frame[1] === 3) {
            gatewayConfig.ok = true;
          }
          break;

        case config.CIE_commands.GET_GATEWAY_LOG:
          gatewayConfig.log = uintToString(frame, 2, 126);
          break;
      }
    }

    callback(gatewayConfig);
  },

  parseSystemConfig: function (system, callback) {
    var frame = Array(128).fill(0);

    frame[0] = 0;
    frame[config.system.config] = 0x0f;
    frame[config.system.end_config] = 1;

    frame[config.system.net_add] = parseInt(system.endereco);

    for (var k = 0; k < config.system.installation_length; k++) {
      if (system.local_instalacao.charCodeAt(k)) {
        frame[config.system.installation + k] =
          system.local_instalacao.charCodeAt(k);
      } else {
        frame[config.system.installation + k] = 0;
      }
    }
    for (var index = 2; index < 5; index++) {
      var field = "password_" + index;
      var json_field = "senha_" + index;
      for (var k = 0; k < config.system.password_length; k++) {
        frame[config.system[field] + k] = system[json_field].charCodeAt(k) || 0;
      }
    }

    frame[config.system.operation_mode] = system.operacao == "A" ? 0 : 1;
    frame[config.system.delay_min] = parseInt(system.retardo.split(":")[0]);
    frame[config.system.delay_sec] = parseInt(system.retardo.split(":")[1]);

    frame[config.system_std_out.alarm_blocked] = system.alarme.habilitada
      ? 0
      : 1;
    frame[config.system_std_out.alarm_loop] = parseInt(system.alarme.laco);
    frame[config.system_std_out.alarm_address] = parseInt(
      system.alarme.endereco
    );
    frame[config.system_std_out.alarm_delay_min] = parseInt(
      system.alarme.temporizador.split(":")[0]
    );
    frame[config.system_std_out.alarm_delay_sec] = parseInt(
      system.alarme.temporizador.split(":")[1]
    );

    frame[config.system_std_out.fault_blocked] = system.falha.habilitada
      ? 0
      : 1;
    frame[config.system_std_out.fault_loop] = parseInt(system.falha.laco);
    frame[config.system_std_out.fault_address] = parseInt(
      system.falha.endereco
    );
    frame[config.system_std_out.fault_delay_min] = parseInt(
      system.falha.temporizador.split(":")[0]
    );
    frame[config.system_std_out.fault_delay_sec] = parseInt(
      system.falha.temporizador.split(":")[1]
    );

    frame[config.system_std_out.sup_blocked] = system.supervisao.habilitada
      ? 0
      : 1;
    frame[config.system_std_out.sup_loop] = parseInt(system.supervisao.laco);
    frame[config.system_std_out.sup_address] = parseInt(
      system.supervisao.endereco
    );
    frame[config.system_std_out.sup_delay_min] = parseInt(
      system.supervisao.temporizador.split(":")[0]
    );
    frame[config.system_std_out.sup_delay_sec] = parseInt(
      system.supervisao.temporizador.split(":")[1]
    );

    if (system.repetidoras) {
      for (var index = 0; index < 4; index++) {
        frame[config.system.repeaters + index] = system.repetidoras[index]
          ? 1
          : 0;
      }
    }

    for (index = 0; index < 16; index++) {
      frame[config.system.enabled_cies + index] = system.interligacao.centrais[
        index
      ]
        ? 1
        : 0;
    }

    frame[config.system.cie_restart] = system.interligacao.reiniciar_central
      ? 1
      : 0;
    frame[config.system.general_alarm] = system.interligacao.alarme_geral
      ? 1
      : 0;
    frame[config.system.brigade_siren] = system.interligacao.sirene_brigada
      ? 1
      : 0;
    frame[config.system.silence_siren] = system.interligacao.silenciar_sirene
      ? 1
      : 0;
    frame[config.system.silence_central] = system.interligacao.silenciar_central
      ? 1
      : 0;

    frame[config.system.dhcp] = system.rede.dhcp ? 1 : 0;
    frame[config.system.p2p] = system.rede.p2p ? 1 : 0;

    var split = system.rede.ip.split(".");
    if (split.length === 4) {
      for (index = 0; index < 4; index++) {
        frame[config.system.ip + index] = parseInt(split[index]);
      }
    }

    split = system.rede.mascara.split(".");
    if (split.length === 4) {
      for (index = 0; index < 4; index++) {
        frame[config.system.mask + index] = parseInt(split[index]);
      }
    }

    split = system.rede.gateway.split(".");
    if (split.length === 4) {
      for (index = 0; index < 4; index++) {
        frame[config.system.gateway + index] = parseInt(split[index]);
      }
    }

    frame[config.system.external_battery] = system.bateria_externa ? 1 : 0;
    frame[config.system.pre_alarm] = system.pre_alarme ? 1 : 0;
    frame[config.system.modbus] = system.modbus ? 1 : 0;
    frame[config.system.gw521] = system.gw521 ? 1 : 0;

    callback(frame);
  },

  unparseSystemConfig: function (frame, callback) {
    var systemConfig = {};

    systemConfig.endereco = parseInt(frame[config.system.net_add - 1]);

    var array_site = frame.slice(
      config.system.installation - 1,
      config.system.installation - 1 + config.system.installation_length
    );

    systemConfig.local_instalacao = "";
    for (var i = 0; i < array_site.length; i++) {
      if (array_site[i])
        systemConfig.local_instalacao += String.fromCharCode(array_site[i]);
    }

    for (var index = 2; index < 5; index++) {
      var field = "password_" + index;
      var json_field = "senha_" + index;

      var array_pass = frame.slice(
        config.system[field] - 1,
        config.system[field] - 1 + config.system.password_length
      );
      var pass = "";
      for (var k = 0; k < config.system.password_length; k++) {
        if (array_pass[k] !== 0) pass += String.fromCharCode(array_pass[k]);
      }
      systemConfig[json_field] = pass;
    }

    var min, sec;

    if (frame[config.system.delay_min - 1] < 10) {
      min = "0" + frame[config.system.delay_min - 1];
    } else {
      min = frame[config.system.delay_min - 1];
    }

    if (frame[config.system.delay_sec - 1] < 10) {
      sec = "0" + frame[config.system.delay_sec - 1];
    } else {
      sec = frame[config.system.delay_sec - 1];
    }

    systemConfig.retardo = min + ":" + sec;
    systemConfig.operacao =
      frame[config.system.operation_mode - 1] == 0 ? "A" : "B";

    systemConfig.alarme = {
      habilitada: frame[config.system_std_out.alarm_blocked - 1] == 0,
      laco: frame[config.system_std_out.alarm_loop - 1],
      endereco: frame[config.system_std_out.alarm_address - 1],
      temporizador:
        ("00" + frame[config.system_std_out.alarm_delay_min - 1]).slice(-2) +
        ":" +
        ("00" + frame[config.system_std_out.alarm_delay_sec - 1]).slice(-2),
    };

    systemConfig.falha = {
      habilitada: frame[config.system_std_out.fault_blocked - 1] == 0,
      laco: frame[config.system_std_out.fault_loop - 1],
      endereco: frame[config.system_std_out.fault_address - 1],
      temporizador:
        ("00" + frame[config.system_std_out.fault_delay_min - 1]).slice(-2) +
        ":" +
        ("00" + frame[config.system_std_out.fault_delay_sec - 1]).slice(-2),
    };

    systemConfig.supervisao = {
      habilitada: frame[config.system_std_out.sup_blocked - 1] == 0,
      laco: frame[config.system_std_out.sup_loop - 1],
      endereco: frame[config.system_std_out.sup_address - 1],
      temporizador:
        ("00" + frame[config.system_std_out.sup_delay_min - 1]).slice(-2) +
        ":" +
        ("00" + frame[config.system_std_out.sup_delay_sec - 1]).slice(-2),
    };

    systemConfig.repetidoras = [];
    for (index = 0; index < 4; index++) {
      systemConfig.repetidoras.push(
        frame[config.system.repeaters - 1 + index] === 1
      );
    }

    systemConfig.repetidoras = [];
    for (index = 0; index < 4; index++) {
      systemConfig.repetidoras.push(
        frame[config.system.repeaters - 1 + index] === 1
      );
    }

    systemConfig.interligacao = {
      centrais: [],
      reiniciar_central: false,
      alarme_geral: false,
      sirene_brigada: false,
      silenciar_sirene: false,
    };

    for (index = 0; index < 16; index++) {
      systemConfig.interligacao.centrais.push(
        frame[config.system.enabled_cies - 1 + index] === 1
      );
    }

    systemConfig.interligacao.reiniciar_central =
      frame[config.system.cie_restart - 1] === 1;
    systemConfig.interligacao.alarme_geral =
      frame[config.system.general_alarm - 1] === 1;
    systemConfig.interligacao.sirene_brigada =
      frame[config.system.brigade_siren - 1] === 1;
    systemConfig.interligacao.silenciar_sirene =
      frame[config.system.silence_siren - 1] === 1;
    systemConfig.interligacao.silenciar_central =
      frame[config.system.silence_central - 1] === 1;

    systemConfig.bateria_externa =
      frame[config.system.external_battery - 1] === 1;
    systemConfig.pre_alarme = frame[config.system.pre_alarm - 1] === 1;
    systemConfig.modbus = frame[config.system.modbus - 1] === 1;
    systemConfig.gw521 = frame[config.system.gw521 - 1] === 1;

    systemConfig.rede = {};
    systemConfig.rede.p2p = frame[config.system.p2p - 1] === 1;
    systemConfig.rede.dhcp = frame[config.system.dhcp - 1] === 1;
    systemConfig.rede.ip =
      frame[config.system.ip - 1] +
      "." +
      frame[config.system.ip - 1 + 1] +
      "." +
      frame[config.system.ip - 1 + 2] +
      "." +
      frame[config.system.ip - 1 + 3];
    systemConfig.rede.mascara =
      frame[config.system.mask - 1] +
      "." +
      frame[config.system.mask - 1 + 1] +
      "." +
      frame[config.system.mask - 1 + 2] +
      "." +
      frame[config.system.mask - 1 + 3];
    systemConfig.rede.gateway =
      frame[config.system.gateway - 1] +
      "." +
      frame[config.system.gateway - 1 + 1] +
      "." +
      frame[config.system.gateway - 1 + 2] +
      "." +
      frame[config.system.gateway - 1 + 3];

    systemConfig.without_ethernet =
      frame[config.system.has_network_board - 1] === 0;

    var mac = "";
    try {
      for (
        var index = config.system.mac_addr - 1;
        index < config.system.mac_addr - 1 + 6;
        index++
      ) {
        mac += ("00" + frame[index].toString(16)).slice(-2) + ":";
      }
      mac = mac.substring(0, mac.length - 1).toUpperCase();
    } catch (e) {}

    systemConfig.endereco_mac = mac;

    callback(systemConfig);
  },

  parseDate: function (dh, callback) {
    var DD, MM, AA, hh, mm, ss;
    DD = parseInt(dh.data.split("/")[0]);
    MM = parseInt(dh.data.split("/")[1]);
    AA = parseInt(dh.data.split("/")[2]) - 2000;

    hh = parseInt(dh.hora.split(":")[0]);
    mm = parseInt(dh.hora.split(":")[1]);
    ss = parseInt(dh.hora.split(":")[2]);

    callback([0, 0x1b, DD, MM, AA, hh, mm, ss]);
  },

  unparseDate: function (frame, callback) {
    var date = {};
    var DD, MM, AA, hh, mm, ss;
    DD = frame[1];
    MM = frame[2];
    AA = frame[3];

    hh = frame[4];
    mm = frame[5];
    ss = frame[6];

    date.data = pad(DD) + "/" + pad(MM) + "/20" + pad(AA);
    date.hora = pad(hh) + ":" + pad(mm) + ":" + pad(ss);

    callback(date);
  },

  unparseInfo: function (frame, callback) {
    var info = {};

    var array_lote = frame.slice(
      config.info.batch,
      config.info.batch_length + config.info.batch
    );

    info.firmware =
      frame[config.info.version] +
      "." +
      frame[config.info.release] +
      "." +
      frame[config.info.revision];
    info.versaoFonte =
      frame[config.info.power_supply_version] +
      "." +
      frame[config.info.power_supply_revision] +
      "." +
      frame[config.info.power_supply_release];
    info.versaoLaco =
      frame[config.info.loop_version] + "." + frame[config.info.loop_release];
    info.versaoProtocolo =
      frame[config.info.protocol_version] +
      "." +
      frame[config.info.protocol_release];
    info.centralModel = modelos_centrais[frame[config.info.central_model]];
    info.centralConectadaRepetidora =
      modelos_centrais[frame[config.info.central_model_on_rp]];

    info.enderecoMac = "";
    for (var index = 0; index < 6; index++) {
      info.enderecoMac +=
        ("00" + frame[config.info.mac_addr + index].toString(16)).slice(-2) +
        ":";
    }
    info.enderecoMac = info.enderecoMac
      .substring(0, info.enderecoMac.length - 1)
      .toUpperCase();

    info.lote = String.fromCharCode.apply(null, array_lote);

    info.networkMode = frame[config.info.networkMode];
    info.ip = arrayToIp(frame, config.info.ip);
    info.gateway = arrayToIp(frame, config.info.gateway);
    info.mascara = arrayToIp(frame, config.info.mask);

    callback(info);
  },

  unparseLogsUdp: function (frame) {
    var positions = config.eventsUdp;
    var log = {};

    log.zona = frame[positions.zone];
    log.endereco = frame[positions.address];
    log.id = Buffer.from(
      frame.slice(positions.log_id, positions.log_id + 2)
    ).readUInt16LE();
    log.origem = this.extractBits(frame, positions.source);
    log.laco = this.extractBits(frame, positions.loop);

    log.tipo = frame[positions.event_type];
    log.bloqueado = this.extractBits(frame, positions.device_blocked);
    log.repetidora = this.extractBits(frame, positions.repeater_addr);

    var device_array_name = frame.slice(
      positions.device_name,
      positions.device_name + positions.device_name_length
    );
    log.nome_dispositivo = String.fromCharCode.apply(null, device_array_name);

    log.tipo_dispositivo = frame[positions.device_type];
    log.subtipo_dispositivo = this.extractBits(frame, positions.device_subtype);

    var zone_array_name = frame.slice(
      positions.zone_name,
      positions.zone_name + positions.zone_name_length
    );
    log.nome_zona = String.fromCharCode.apply(null, zone_array_name);

    var hh, mm, ss;
    hh = new Number(frame[positions.hour]).toString(16);
    mm = new Number(frame[positions.minutes]).toString(16);
    ss = new Number(frame[positions.seconds]).toString(16);

    log.hora = pad(hh) + ":" + pad(mm) + ":" + pad(ss);

    var DD, MM, AA;
    DD = new Number(frame[positions.day]).toString(16);
    MM = new Number(frame[positions.month]).toString(16);
    AA = new Number(frame[positions.year]).toString(16);
    log.data = pad(DD) + "/" + pad(MM) + "/20" + pad(AA);
    log.date = {
      year: parseInt("20" + pad(AA)),
      month: MM,
      day: DD,
      hour: hh,
      min: mm,
      sec: ss,
    };

    if (frame[positions.log_type] !== 3) {
      log.primeiro_evento = frame[positions.first_event] !== 0;
    } else {
      log.primeiro_evento = false;
    }

    var length = Buffer.from(
      frame.slice(positions.length_of_type, positions.length_of_type + 2)
    );
    log.contador = length.readUInt16LE();

    return log;
  },

  unparseLogsConfig: function (frame, callback, progressCallback) {
    var emptyBuffer = Buffer.alloc(config.log.offset - 3);

    var logs = [];
    for (var i = 0; i < config.log.qty; i++) {
      let log = {};
      var logBuffer = frame.slice(
        3 + i * config.log.offset,
        (i + 1) * config.log.offset
      );
      //se o frame do log estiver vazio significa que ja recebeu todos os registros desse tipo de evento
      if (emptyBuffer.compare(logBuffer) == 0) {
        break;
      }

      //let progress = ((i + 1) / config.log.qty) * 100;
      //progressCallback(progress);

      var sequence = Buffer.from(
        frame.slice(
          config.log.sequence + i * config.log.offset,
          config.log.sequence + i * config.log.offset + 4
        )
      );
      log.sequence = sequence.readInt32LE();

      log.endereco = frame[config.log.address + i * config.log.offset];
      log.id = frame[config.log.log_id + i * config.log.offset];
      log.origem = frame[config.log.source + i * config.log.offset];
      log.num_placa = frame[config.log.board_number + i * config.log.offset];
      log.laco = frame[config.log.loop + i * config.log.offset];
      log.zona = frame[config.log.zone + i * config.log.offset];
      log.tipo = frame[config.log.event_type + i * config.log.offset];
      log.bloqueado = frame[config.log.device_blocked + i * config.log.offset];
      log.repetidora = frame[config.log.repeater_addr + i * config.log.offset];

      var device_array_name = frame.slice(
        config.log.device_name + i * config.log.offset,
        config.log.device_name +
          i * config.log.offset +
          config.log.device_name_length
      );
      log.nome_dispositivo = String.fromCharCode.apply(null, device_array_name);

      log.tipo_dispositivo =
        frame[config.log.device_type + i * config.log.offset];
      log.subtipo_dispositivo =
        frame[config.log.device_subtype + i * config.log.offset];

      var zone_array_name = frame.slice(
        config.log.zone_name + i * config.log.offset,
        config.log.zone_name +
          i * config.log.offset +
          config.log.zone_name_length
      );
      log.nome_zona = String.fromCharCode.apply(null, zone_array_name);

      var hh, mm, ss;
      hh = frame[config.log.hour + i * config.log.offset];
      mm = frame[config.log.minutes + i * config.log.offset];
      ss = frame[config.log.seconds + i * config.log.offset];

      log.hora = pad(hh) + ":" + pad(mm) + ":" + pad(ss);

      var DD, MM, AA;
      DD = frame[config.log.day + i * config.log.offset];
      MM = frame[config.log.month + i * config.log.offset];
      AA = frame[config.log.year + i * config.log.offset];
      log.data = pad(DD) + "/" + pad(MM) + "/20" + pad(AA);
      log.date = {
        year: parseInt("20" + pad(AA)),
        month: MM,
        day: DD,
        hour: hh,
        min: mm,
        sec: ss,
      };

      if (frame[config.log.log_type + config.log.offset * i] != 3) {
        log.primeiro_evento =
          frame[config.log.first_event + i * config.log.offset] != 0;
      } else {
        log.regra_ativacao =
          frame[config.log.rule_activation + i * config.log.offset];
        log.primeiro_evento = false;
      }

      var tipoEvento = frame[config.log.log_type + i * config.log.offset];
      log.evento = config.log.events[tipoEvento].label;
      logs.push(log);
    }
    callback(logs);
  },

  parseFirmware: function (data, command, callback) {
    /*
     *  Comando 0
     *  Frame do firmware
     */
    var frames = [];
    //cabecalho de cada frame - comando 0
    var header = Buffer.from([0, command, 0]);

    var buffer;
    //remove o caractere <CR>
    //transforma o binario em um array Uint8
    if (command !== config.CIE_commands.SEND_FIRMWARE) {
      var clearCR = Buffer.from(data).toString().replace(/(\r)/gm, "");
      buffer = Buffer.from(clearCR, "binary");
    } else {
      buffer = Buffer.from(data, "binary");
    }
    var qtyFrames =
      parseInt(buffer.byteLength / config.firmware.qty) +
      (buffer.byteLength % config.firmware.qty ? 1 : 0);

    if (
      !centralVersion ||
      (centralVersion && centralVersion >= 310) ||
      (centralModel && centralModel === "GATEWAY")
    ) {
      for (var i = 0; i < qtyFrames; i++) {
        var start = i * config.firmware.qty;
        var end = (i + 1) * config.firmware.qty;
        var rest = buffer.byteLength % config.firmware.qty;
        var dataSize =
          i === qtyFrames - 1
            ? rest === 0
              ? config.firmware.qty
              : rest
            : config.firmware.qty;
        var bufferIndex = Buffer.allocUnsafe(4);
        bufferIndex.writeUInt32LE(i * config.firmware.qty);
        frames[i] = Buffer.concat(
          [
            header, //3 bytes
            new Uint8Array(bufferIndex), //4 bytes
            new Uint8Array([dataSize]), //1 bytes
            buffer.slice(start, end), //120 bytes
          ],
          128
        );
      }
    } else {
      for (var i = 0; i < qtyFrames; i++) {
        //concatenacao do header com o frame de firmware
        frames[i] = Buffer.concat(
          [
            header,
            buffer.slice(
              i * config.firmware.qty,
              (i + 1) * config.firmware.qty
            ),
          ],
          128
        );
      }
    }

    /*
     *  Comando 2
     *  Frame da quantidade de bytes do firmware
     */
    //cabecalho do frame da quantidade de bytes do firmware - comando 2
    var headerSize = Buffer.from([0, command, 2]);
    var arr = new Uint32Array(1);
    var length = buffer.length;
    arr[0] = length;
    var lengthBuffer = Buffer.from(arr.buffer);
    //concatenacao do header com o framde da qtd de bytes
    var lengthFrame = Buffer.concat(
      [headerSize, lengthBuffer, Buffer.alloc(128)],
      128
    );

    /*
     *  Comando 1
     *  Frame do CRC do firmware
     */
    //cabecalho do frame de CRC - comando 1
    var headerCRC = Buffer.from([0, command, 1]);
    //conversao do header CRC de 32 bits para Uint8
    var crc = crcLib.crc32(buffer);
    var crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32LE(crc, 0);

    //concatenacao do header com o framde do crc
    var crcFrame = Buffer.concat(
      [headerCRC, crcBuffer, Buffer.alloc(128)],
      128
    );

    callback({
      frames: frames,
      crc: crcFrame,
      lengthFrame: lengthFrame,
    });
  },
  extractBits: function (data, position) {
    var byte_novo =
      (data[position.p] >> position.start) &
      createMask(position.end - position.start);
    return byte_novo;
  },
  getBitInByteHigh: function (data, position) {
    return bitwise.byte.read(data)[position];
  },
  getBitInByteLow: function (data, position) {
    return bitwise.byte.read(data).reverse()[position];
  },
};

function getBit(number, bitPosition) {
  return (number & (1 << bitPosition)) === 0 ? 0 : 1;
}

function pad(n) {
  return n < 10 ? "0" + n : n;
}

function pad3(n) {
  return ("000" + n.toString()).slice(-3);
}

Array.prototype.repeat = function (what, L) {
  while (L) this[--L] = what;
  return this;
};

function arrayToIp(array, position) {
  return (
    array[position] +
    "." +
    array[position + 1] +
    "." +
    array[position + 2] +
    "." +
    array[position + 3]
  );
}

function createMask(num_bitmask) {
  var nMask = 0;
  for (var var_num_mask = 0; var_num_mask < num_bitmask; var_num_mask++) {
    nMask = nMask | (1 << var_num_mask);
  }
  return nMask;
}

function minSecToMilliseconds(string) {
  var milliSeconds = 0;
  try {
    var stringSplit = string.split(":");
    milliSeconds += +stringSplit[0] * 60;
    milliSeconds += +stringSplit[1];
    milliSeconds = milliSeconds * 1000;
  } catch (e) {
    return milliSeconds;
  }
  return milliSeconds;
}

function minSecToInt(string) {
  var minutes = 0;
  try {
    var stringSplit = string.split(":");
    minutes += +stringSplit[0] * 60;
    minutes += +stringSplit[1];
  } catch (e) {
    console.log(e);
  }
  return minutes;
}

function intToMinSec(secs) {
  try {
    var t = new Date(1970, 0, 1, 0, 0, 0, 0);
    t.setSeconds(secs);
    return pad(t.getMinutes()) + ":" + pad(t.getSeconds());
  } catch (e) {
    console.log(e);
  }
  return "00:00";
}

function millisecondsToMinSec(mili) {
  try {
    var t = new Date(1970, 0, 1, 0, 0, 0, 0);
    t.setMilliseconds(mili);
    return pad(t.getMinutes()) + ":" + pad(t.getSeconds());
  } catch (e) {
    console.log(e);
  }
  return "00:00";
}

function isIpAddress(ipaddress) {
  return netModule.isIP(ipaddress) !== 0;
}

function read16(frame, position) {
  return Buffer.from(frame.slice(position - 1, position + 1)).readUInt16LE();
}

function read32(frame, position) {
  return Buffer.from(frame.slice(position - 1, position + 3)).readUInt32LE();
}

function uintToString(frame, position, length) {
  const buffer = Buffer.from(frame.slice(position - 1, position + length - 1));

  const encodedString = String.fromCharCode.apply(null, buffer);
  //const encodedString = buffer.toString('utf-8');

  return trimNull(encodedString);
}

function trimNull(str) {
  return str.replace(/\0/g, "").trim();
}

function trimNull(string) {
  try {
    return string.replace(/\0/g, "");
  } catch (e) {
    return "";
  }
}

function parseDateCertificate(frame, position) {
  var DD, MM, AA, hh, mm, ss;
  AA = read16(frame, position);
  position--;
  MM = frame[position + 2];
  DD = frame[position + 3];
  hh = frame[position + 4];
  mm = frame[position + 5];
  ss = frame[position + 6];
  return (
    pad(DD) +
    "/" +
    pad(MM) +
    "/" +
    pad(AA) +
    " - " +
    pad(hh) +
    ":" +
    pad(mm) +
    ":" +
    pad(ss)
  );
}
