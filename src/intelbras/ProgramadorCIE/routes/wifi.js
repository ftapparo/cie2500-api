const { exec } = require("child_process");
const os = require("os");

let shellCommand = "";
let getConnectionWifiNameFunction;
const commands = {
  mac: '/Sy*/L*/Priv*/Apple8*/V*/C*/R*/airport -I | sed -n "s/^.*SSID: \\(.*\\)$/\\1/p"',
  windows: __dirname + "\\getConnectedWifi.bat",
};

if (isWindows()) {
  shellCommand = commands.windows;
  getConnectionWifiNameFunction = getConnectedWifiWindows;
} else {
  shellCommand = commands.mac;
  getConnectionWifiNameFunction = getConnectedWifi;
}

var wifi = {
  tcp: undefined,
  verifyWifiConnected: async function () {
    return new Promise(async (acc, rej) => {
      getConnectionWifiNameFunction(async (currentConnection) => {
        //console.log("getConnectedWifi", currentConnection);
        try {
          if (!currentConnection) {
            rej();
          } else {
            if (currentConnection) {
              let model = undefined;
              if (currentConnection.startsWith("CIE1060")) {
                model = "CIE1060";
              } else if (currentConnection.startsWith("CIE ")) {
                model = currentConnection.split("-")[0].replace(" ", "");
              }
              if (model) {
                let ping;
                if (model === "CIE1060") {
                  ping = await this.tcp["1060"].ping();
                } else {
                  ping = await this.tcp.default.ping();
                }
                if (ping) {
                  acc(model);
                } else {
                  rej();
                }
              } else {
                rej();
              }
            } else {
              rej();
            }
          }
        } catch (e) {
          rej();
        }
      });
    });
  },
  testAndGetVersion: async function () {
    const model = await wifi.verifyWifiConnected();
    let version = "";
    if (model === "CIE1060") {
      await this.tcp["1060"].changeHandshakeTimeout();
      version = await this.tcp["1060"].getFirmwareVersion();
      version = version.version;
    } else {
      version = await this.tcp.default.getVersion();
    }
    return { model, version };
  },
  transmitting: function (model) {
    if (!model) {
      return false;
    }
    if (model === "CIE1060") {
      return this.tcp["1060"].transmitting;
    } else {
      return this.tcp.default.transmitting;
    }
  },
};

function run(command, callback) {
  exec(command, (err, stdout, stderr) => {
    if (!err) {
      callback(stdout);
    } else {
      callback(undefined);
    }
  });
}

function getConnectedWifiWindows(callback) {
  run(shellCommand, function (wifi) {
    try {
      if (wifi) {
        const wifiName = wifi
          .split("SSID")
          .map((w) => w.replace(/:/g, "").trim())[1]
          .split("\r\n")[0];
        callback(wifiName);
      } else {
        callback(undefined);
      }
    } catch (e) {
      callback(undefined);
    }
  });
}

function getConnectedWifi(callback) {
  run(shellCommand, function (wifi) {
    try {
      if (wifi) {
        const wifiName = wifi.replace(/\n/g, "").trim();
        callback(wifiName);
      } else {
        callback(undefined);
      }
    } catch (e) {
      callback(undefined);
    }
  });
}

function isWindows() {
  return os.platform() === "win32";
}

module.exports = wifi;
