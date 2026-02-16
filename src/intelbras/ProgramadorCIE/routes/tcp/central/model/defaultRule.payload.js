"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultRulePayload = void 0;
var buffer_1 = require("buffer");
var bitwise_1 = require("bitwise");
var struct_1 = require("../../js-libs/struct");
var RuleBytePosition = {
  bloqueio: 0,
  responderBotaoAlarmeGeral: 1,
  entradaUnicaOuDupla: 2,
  ativacaoDeSaidaImediataTemporizada: 3,
  novaEntradaCancelaTemporizacao: 4,
};
var DefaultRulePayload = /** @class */ (function () {
  function DefaultRulePayload() {
    this.struct = new struct_1.Struct()
      .word8("config")
      .word8("minutos")
      .word8("segundos")
      .word64Ule("dispositivosNaRegra")
      .word8("vago1")
      .word8("vago1")
      .word8("vago2")
      .word8("vago3")
      .word8("vago4");
    this.struct.allocate();
  }
  DefaultRulePayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var byteConfig = 0;
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      RuleBytePosition.bloqueio,
      properties.ativada ? 0 : 1
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      RuleBytePosition.responderBotaoAlarmeGeral,
      properties.responderBotaoAlarmeGeral ? 1 : 0
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      RuleBytePosition.entradaUnicaOuDupla,
      properties.entradaUnicaOuDupla === "unica" ? 0 : 1
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      RuleBytePosition.ativacaoDeSaidaImediataTemporizada,
      properties.ativacaoDeSaidaImediataTemporizada === "imediata" ? 0 : 1
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      RuleBytePosition.novaEntradaCancelaTemporizacao,
      properties.novaEntradaCancelaTemporizacao ? 1 : 0
    );
    var proxy = this.struct.fields;
    try {
      var splited = properties.delayTime.split(":");
      proxy.minutos = parseInt(splited[0], 10);
      proxy.segundos = parseInt(splited[1], 10);
      proxy.config = byteConfig;
    } catch (e) {
      console.error(e);
    }
    return buf;
  };
  DefaultRulePayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var defaultRule = {
      ativada:
        bitwise_1.default.integer.getBit(
          proxy.config,
          RuleBytePosition.bloqueio
        ) === 0,
      delayTime: ""
        .concat(String(proxy.minutos).padStart(2, "0"), ":")
        .concat(String(proxy.segundos).padStart(2, "0")),
      responderBotaoAlarmeGeral:
        bitwise_1.default.integer.getBit(
          proxy.config,
          RuleBytePosition.responderBotaoAlarmeGeral
        ) === 1,
      entradaUnicaOuDupla:
        bitwise_1.default.integer.getBit(
          proxy.config,
          RuleBytePosition.entradaUnicaOuDupla
        ) === 0
          ? "unica"
          : "dupla",
      ativacaoDeSaidaImediataTemporizada:
        bitwise_1.default.integer.getBit(
          proxy.config,
          RuleBytePosition.ativacaoDeSaidaImediataTemporizada
        ) === 0
          ? "imediata"
          : "temporizada",
      novaEntradaCancelaTemporizacao:
        bitwise_1.default.integer.getBit(
          proxy.config,
          RuleBytePosition.novaEntradaCancelaTemporizacao
        ) === 1,
    };
    return defaultRule;
  };
  return DefaultRulePayload;
})();
exports.DefaultRulePayload = DefaultRulePayload;
