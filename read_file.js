const rchainToolkit = require("rchain-toolkit");
require("dotenv").config();

const { getProcessArgv } = require("./utils");
const main = async () => {
  const log = a => {
    console.log(new Date().toISOString(), a);
  };

  const fileAddress = getProcessArgv("--file-address");

  if (!fileAddress) {
    log("Please provide --file-address (format registry_uri.file_id)");
    process.exit();
  }

  log("host : " + process.env.HOST);
  log("port (HTTP): " + process.env.HTTP_PORT);
  log("Deploying ...");

  const rnodeHttpUrl = `${process.env.HOST}:${process.env.HTTP_PORT}`;

  rchainToolkit.http
    .exploreDeploy(rnodeHttpUrl, {
      term: `
new return, filesModuleCh, lookup(\`rho:registry:lookup\`), stdout(\`rho:io:stdout\`) in {

  lookup!(\`rho:id:${fileAddress.split(".")[0]}\`, *filesModuleCh) |

  for(filesModule <- filesModuleCh) {
      for (x <- *filesModule.get("files").get("${fileAddress.split(".")[1]}")) {
        return!(*x)
      }
  }
}`
    })
    .then(a => {
      console.log("file :");
      console.log(a);
    });
};

main();
