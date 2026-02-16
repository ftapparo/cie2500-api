"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketDefaultService = exports.Socket1060Service = void 0;
var socket_service_1 = require("./cie1060/socket.service");
Object.defineProperty(exports, "Socket1060Service", {
  enumerable: true,
  get: function () {
    return socket_service_1.SocketService;
  },
});
var socket_service_2 = require("./cieDefault/socket.service");
Object.defineProperty(exports, "SocketDefaultService", {
  enumerable: true,
  get: function () {
    return socket_service_2.SocketService;
  },
});
