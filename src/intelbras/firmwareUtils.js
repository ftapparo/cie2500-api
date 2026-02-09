const { exec } = require("child_process");
const pathNode = require("path");
const nwPath = process.execPath;

const location = pathNode.dirname(nwPath);
// const location = 'C:\\Users\\Pablo\\Desktop\\workspace\\programador-cie';
const commandUpdate = `"${location}\\STM32CubeProgrammer\\bin\\STM32_Programmer_CLI" -c port=usb1 -rdu -w "{FIRMWARE_PATH}" 0x08000000 -v --go 0x08000000`;

const FirmwareUtils = {
  update: async function (path, callback) {
    try {
      var attempts = 0;
      var stop = false;
      var firmwarePath = commandUpdate.replace(
        /{FIRMWARE_PATH}/g,
        pathNode.join(__dirname, "..", path)
      );
      var waitingTimeout = undefined;
      let updating = false;
      while (!stop) {
        await new Promise((acc, rej) => {
          waitingTimeout = setTimeout(() => {
            if (updating) {
              attempts++;
              acc();
            }
          }, 10000);
          updating = true;
          run(firmwarePath, function (resp) {
            updating = false;
            clearTimeout(waitingTimeout);
            if (attempts > 2) {
              stop = true;
              callback(resp);
              acc();
            }
            if (resp.error) {
              attempts++;
              acc();
            }
            if (resp.success) {
              stop = true;
              callback(resp);
              acc();
            }
          });
        });
      }
    } catch (e) {
      throw e;
    }
  },
};

function run(command, callback) {
  exec(command, (err, stdout, stderr) => {
    if (!err) {
      if (stdout.includes("Error:")) {
        console.error(stdout);
        alert(stdout);
        callback({ error: true });
      } else {
        callback({ success: true });
      }
    } else {
      console.error(err);
      alert(stdout);
      callback({ error: true });
    }
  });
}

module.exports = FirmwareUtils;
