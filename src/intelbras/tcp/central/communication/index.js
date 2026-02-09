"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CieDefaultServiceCommunication = exports.Cie1060Communication = void 0;
var comunication_service_1 = require("./cie1060/comunication.service");
Object.defineProperty(exports, "Cie1060Communication", {
  enumerable: true,
  get: function () {
    return comunication_service_1.CommunicationService;
  },
});
var comunication_service_2 = require("./cieDefault/comunication.service");
Object.defineProperty(exports, "CieDefaultServiceCommunication", {
  enumerable: true,
  get: function () {
    return comunication_service_2.CommunicationService;
  },
});
