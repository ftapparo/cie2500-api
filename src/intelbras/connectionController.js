var config = require("./config")();
var writeToWebsocket;
var usb;
var udp;
const Controller = require("./CIE_USB");
var wifi = require("./wifi");

var ConnectionController = {
  connectedModel: undefined,
  connectionStatus: false,
  sendUsbFn: undefined,
  sendNetworkFn: undefined,
  connectionMode: config.connectionsMode.USB,
  usbTestConnectionTimeout: undefined,
  wifiTimeout: undefined,
  changeConnectionMode: function (mode) {
    const changedConnectionMode = mode != this.connectionMode;
    this.connectionMode = mode;
    console.log("Changed Connection Mode", mode);
    this.test(changedConnectionMode);
  },
  stopWifiConnection: function () {
    clearInterval(ConnectionController.wifiTimeout);
  },
  sendToCentral: function (data) {
    var _this = ConnectionController;

    if (_this.connectionMode === config.connectionsMode.NETWORK) {
      usb.sendTCPFn(Buffer.from(data.slice(1)));
    } else {
      usb.sendUSBFn(data);
    }
  },
  sendToCentralProtocolUDP: function (data) {
    var _this = ConnectionController;

    if (_this.connectionMode === config.connectionsMode.NETWORK) {
      try {
        if (!Array.isArray(data)) {
          data = Array.from(data);
        }
        udp.sendFn(new Uint8Array(data.slice(1)));
      } catch (error) {
        console.error("Failed to process data for UDP send:", error, data);
      }
    } else {
      usb.sendUSBFn(data);
    }
  },
  test: function () {
    console.log("test", this.connectionMode);
    clearInterval(ConnectionController.usbTestConnectionTimeout);
    clearInterval(ConnectionController.wifiTimeout);
    ConnectionController.wifiTimeout = undefined;
    ConnectionController.usbTestConnectionTimeout = undefined;
    if (this.connectionMode === config.connectionsMode.NETWORK) {
      usb.stopUsbCommunication();
      ConnectionController.usbTestConnectionTimeout = setInterval(function () {
        writeToWebsocket({
          event: "usb_connected",
          data: usb.hasCIEOnUsbConnected(),
        });
      }, 5000);
      udp.bootstrap();
    } else if (this.connectionMode === config.connectionsMode.USB) {
      var status = usb.testUsbConnection();
      writeToWebsocket(status);
      usb.startTestUSB();
    } else {
      //usb.stopUsbCommunication();
      ConnectionController.testAndGetVersion();
      ConnectionController.wifiTimeout = setInterval(function () {
        console.log(
          "wifi.transmitting(ConnectionController.connectedModel) ",
          wifi.transmitting(ConnectionController.connectedModel)
        );
        if (!wifi.transmitting(ConnectionController.connectedModel)) {
          wifi.verifyWifiConnected().then(
            (model) => {
              ConnectionController.setConnectionStatus(true, "wifi");
              ConnectionController.verifyChangeWifiConnection(model);
              writeToWebsocket({
                event: "connected",
                data: { model },
              });
            },
            (e) => {
              ConnectionController.setConnectionStatus(false, "wifi");
              ConnectionController.verifyChangeWifiConnection(undefined);
              console.log(e);
              writeToWebsocket({ event: "disconnected", data: e });
            }
          );
        }
      }, 4000);
    }
  },
  verifyChangeWifiConnection: function (newModel) {
    if (
      /*ConnectionController.connectedModel && */ ConnectionController.connectedModel !==
      newModel
    ) {
      ConnectionController.test();
    }
    ConnectionController.connectedModel = newModel;
  },
  testAndGetVersion: function () {
    wifi
      .testAndGetVersion()
      .then(({ model, version }) => {
        ConnectionController.setConnectionStatus(true);
        writeToWebsocket({ event: "connected", data: { model, version } });
      })
      .catch((error) => {
        ConnectionController.setConnectionStatus(false);
        writeToWebsocket({ event: "disconnected" });
        console.error("Error testing and getting version:", error);
      });
  },
  setConnectionStatus: function (status, data) {
    ConnectionController.connectionStatus = status;

    if (data) {
      if (data.model == "GATEWAY") {
        Controller.setSendFunction(ConnectionController.sendToCentral);
      }
    } else {
      Controller.setSendFunction(ConnectionController.sendToCentralProtocolUDP);
    }
  },
  hasConnection: function () {
    return ConnectionController.connectionStatus;
  },
  stopComunnication: function () {
    console.log("setConnectionStatus 1");
    ConnectionController.setConnectionStatus(false);
    // TODO: handle case where gw521 connection mode is NETWORK
    if (ConnectionController.connectionMode !== config.connectionsMode.USB) {
      udp.stopCommunication();
    } else {
      usb.startTestUSB();
    }
  },
  setTcpHandler: function (tcp_handler) {
    wifi.tcp = tcp_handler;
  },
};

module.exports = function (cie_usb, cie_udp, webSocket, tcp_handler) {
  cie_usb.sendFn = ConnectionController.sendToCentral;
  cie_usb.stopCommunicationFn = ConnectionController.stopComunnication;
  cie_usb.hasConnection = ConnectionController.hasConnection;
  cie_udp.hasConnection = ConnectionController.hasConnection;
  cie_udp.setConnectionStatus = ConnectionController.setConnectionStatus;
  cie_usb.setConnectionStatus = ConnectionController.setConnectionStatus;
  cie_udp.communicationHandler = cie_usb.CommunicationHandler;
  writeToWebsocket = webSocket;
  usb = cie_usb;
  udp = cie_udp;
  ConnectionController.setTcpHandler(tcp_handler);
  return ConnectionController;
};
