"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordPayload = exports.DeviceByteConfig = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
exports.DeviceByteConfig = {
  bloqueio: 0,
  nomeAlterado: 1,
  regra: 4,
};
var PasswordPayload = /** @class */ (function () {
  function PasswordPayload() {
    this.struct = new struct_1.Struct()
      .word8("tipo")
      .array("password", 4, "word8");
    this.struct.allocate();
  }
  PasswordPayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields;
    proxy.tipo = properties.tipo;
    if (properties.password) {
      proxy.password[0] = parseInt(properties.password.charAt(0), 10);
      proxy.password[1] = parseInt(properties.password.charAt(1), 10);
      proxy.password[2] = parseInt(properties.password.charAt(2), 10);
      proxy.password[3] = parseInt(properties.password.charAt(3), 10);
    }
    return buf;
  };
  PasswordPayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var passwordString = "" + Object.values(proxy.password).join("");
    if (!parseInt(passwordString, 10)) {
      passwordString = "";
    }
    var password = {
      password: passwordString,
      tipo: proxy.tipo,
    };
    return password;
  };
  return PasswordPayload;
})();
exports.PasswordPayload = PasswordPayload;
