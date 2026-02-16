"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyFrame = exports.CommunicationResponseType = void 0;
var buffer_1 = require("buffer");
var CommunicationResponseType;
(function (CommunicationResponseType) {
  CommunicationResponseType["OK"] = "OK";
  CommunicationResponseType["FAIL"] = "FAIL";
  CommunicationResponseType["ERROR"] = "ERROR";
  CommunicationResponseType["CLOSE"] = "CLOSE";
  CommunicationResponseType["TIMEOUT"] = "TIMEOUT";
})(
  (CommunicationResponseType =
    exports.CommunicationResponseType ||
    (exports.CommunicationResponseType = {}))
);
exports.emptyFrame = {
  comando: 0,
  payload: new buffer_1.Buffer([]),
};
