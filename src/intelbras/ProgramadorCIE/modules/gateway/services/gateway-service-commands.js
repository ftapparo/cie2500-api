const fs = require("fs");
const config = require("./config")();
const CIE_commands = config.CIE_commands;
const gateway_service = require("./gateway-service");

//CIE_commands.SET_GATEWAY_FLASH_DUMP
function setGatewayFlashDump(data, config, writeToCIE, dumpFile, frameControl) {
  let obj;

  if (data[1] === 0) {
    if (frameControl < 786432) {
      try {
        const dateFrame = data.slice(2, 98);
        fs.appendFileSync(dumpFile, Buffer.from(dataFrame, "binary"), "binary");

        const frameRequestDump = new Uint8Array(128);
        frameRequestDump[1] = config.CIE_commands.SET_GATEWAY_FLASH_DUMP;

        const frameBuffer = Buffer.alloc(4);
        frameControl += 96;
        frameBuffer.writeUInt32LE(frameControl);

        frameRequestDump.set(frameBuffer, 3);

        writeToCIE(frameRequestDump, `SET_GATEWAY_FLASH_DUMP ${frameControl}`);

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
        [0, config.CIE_commands.SET_GATEWAY_FLASH_DUMP, 4],
        "SET_GATEWAY_FLASH_DUMP 4"
      );
    }
  } else if (data[1] === 4) {
    obj = {
      event: "gateway_save_dump",
      progress: { success: true, end: true },
    };
    dumpFile = "";
  }

  return { obj, frameControl, dumpFile };
}

//CIE_commands.SET_GATEWAY_INFO
function setGatewayInfo(data, writeToCIE, frameControl, parsedGatewayConfig) {
  frameControl++;

  writeToCIE(parsedGatewayConfig[frameControl], "SET_MODBUS_INFO");

  return { frameControl };
}

//CIE_commands.GET_GATEWAY_INF
function getGatewayInfo(data, writeToCIE, parseConfig) {
  return new Promise((resolve, reject) => {
    receivedGatewayFrames.push(data);

    if (configurationUpdating) {
      writeToCIE([0, CIE_commands.GET_MODBUS_INFO], "GET_MODBUS_INFO");
      resolve();
    } else {
      parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
        console.log(
          "--UNPARSED GATEWAY FRAME-- : " + JSON.stringify(gateway_frame)
        );
        let obj = {
          event: "get_info_gateway",
          data: {
            success: true,
            config: gateway_frame,
          },
        };
        resolve(obj);
      });
    }
  });
}

//CIE_commands.SET_GATEWAY_MAC
function setGatewayMac(data) {
  return gateway_service.handleGatewayEvent(data, "gateway_change_mac");
}

//CIE_commands.SET_GATEWAY_ERASE_EVENTS
function setGatewayEraseEvents(data) {
  return gateway_service.handleGatewayEvent(data, "gateway_clear_registers");
}

//CIE_commands.SET_GATEWAY_RESET_FABRICA
function setGatewayResetFabrica(data) {
  return gateway_service.handleGatewayEvent(data, "gateway_factory_reset");
}

//CIE_commands.SET_GATEWAY_RESET
function setGatewayReset(data) {
  return gateway_service.handleGatewayEvent(data, "gateway_restart");
}

//CIE_commands.GET_GATEWAY_ERRORS
function getGatewayErrors(data, parseConfig) {
  return new Promise((resolve, reject) => {
    parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
      console.log(
        "--UNPARSED GATEWAY FRAME-- : " + JSON.stringify(gateway_frame)
      );
      let obj = {
        event: "get_gateway_errors",
        data: { success: true, config: gateway_frame },
      };
      resolve(obj);
    });
  });
}

//CIE_commands.SET_GATEWAY_ADVANCED_CMDS
function setGatewayAdvancedCmds(data, parseConfig) {
  return new Promise((resolve, reject) => {
    parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
      let obj = {
        event: "auth_gateway_advanced_commands",
        data: { success: true, gateway_frame },
      };
      resolve(obj);
    });
  });
}

//CIE_commands.GET_GATEWAY_LOG
function getGatewayLog(data, parseConfig) {
  return new Promise((resolve, reject) => {
    parseConfig.unparseGatewayConfig([data], function (gateway_frame) {
      let obj = {
        event: "gateway_get_log",
        data: { success: true, gateway_frame },
      };
      resolve(obj);
    });
  });
}

module.exports = {
  setGatewayFlashDump,
  setGatewayInfo,
  getGatewayInfo,
  setGatewayMac,
  setGatewayEraseEvents,
  setGatewayResetFabrica,
  setGatewayReset,
  getGatewayErrors,
  setGatewayAdvancedCmds,
  getGatewayLog,
};
