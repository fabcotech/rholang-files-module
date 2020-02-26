const grpc = require("@grpc/grpc-js");
const fs = require("fs");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");
const uuidv4 = require("uuid/v4");
require("dotenv").config();

const { getProcessArgv, buildUnforgeableNameQuery, log } = require("./utils");
const main = async () => {
  const privateKey = getProcessArgv("--private-key");

  const timestamp = new Date().valueOf();

  if (!privateKey) {
    log("Please provide --private-key and --public-key cli arguments");
    process.exit();
  }
  const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(privateKey);

  const phloLimit = 300000;

  log("host (read-only):                   " + process.env.READ_ONLY_HOST);
  log(
    "host (read-only) HTTP port:         " +
      process.env.READ_ONLY_HOST_HTTP_PORT
  );
  log("host (validator):                   " + process.env.VALIDATOR_HOST);
  log(
    "host (validator) HTTP port:         " +
      process.env.VALIDATOR_HOST_HTTP_PORT
  );
  log(
    "host (validator) GRPC propose port: " +
      process.env.VALIDATOR_HOST_GRPC_PROPOSE_PORT
  );
  log("publicKey : " + publicKey);
  log("phlo limit : " + phloLimit);
  log("Deploying ...");

  const httpUrlReadOnly = `${process.env.READ_ONLY_HOST}:${process.env.READ_ONLY_HOST_HTTP_PORT}`;
  const httpUrlValidator = `${process.env.VALIDATOR_HOST}:${process.env.VALIDATOR_HOST_HTTP_PORT}`;
  const grpcUrlValidator = `${process.env.VALIDATOR_HOST}:${process.env.VALIDATOR_HOST_GRPC_PROPOSE_PORT}`;

  const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
    grpcUrlValidator,
    grpc,
    protoLoader
  );

  let prepareDeployResponse;
  try {
    prepareDeployResponse = await rchainToolkit.http.prepareDeploy(
      httpUrlReadOnly,
      {
        deployer: publicKey,
        timestamp: timestamp,
        nameQty: 1
      }
    );
  } catch (err) {
    log("Unable to preview private name");
    console.log(err);
    process.exit();
  }

  let validAfterBlockNumber;
  try {
    validAfterBlockNumber = JSON.parse(
      await rchainToolkit.http.blocks(httpUrlReadOnly, {
        position: 1
      })
    )[0].blockNumber;
  } catch (err) {
    log("Unable to get last finalized block", "error");
    console.log(err);
    process.exit();
  }

  let term = fs.readFileSync("./files.rho", "utf8");
  const nonce = uuidv4().replace(/-/g, "");
  log(`Replaced "NONCE" (found in rholang), with "${nonce}"`);
  term = term
    .replace(new RegExp("PUBLIC_KEY", "g"), publicKey)
    .replace(new RegExp("NONCE", "g"), nonce);

  const deployOptions = await rchainToolkit.utils.getDeployOptions(
    "secp256k1",
    timestamp,
    term,
    privateKey,
    publicKey,
    1,
    phloLimit,
    validAfterBlockNumber || -1
  );

  try {
    const deployResponse = await rchainToolkit.http.deploy(
      httpUrlValidator,
      deployOptions
    );
    if (!deployResponse.startsWith('"Success!')) {
      log("Unable to deploy");
      console.log(deployResponse);
      process.exit();
    }
  } catch (err) {
    log("Unable to deploy");
    console.log(err);
    process.exit();
  }
  log("Deployed files.rho");

  try {
    await new Promise((resolve, reject) => {
      let over = false;
      setTimeout(() => {
        if (!over) {
          over = true;
          reject(
            "Timeout error, waited 8 seconds for GRPC response. Skipping."
          );
        }
      }, 8000);
      rchainToolkit.grpc.propose({}, grpcProposeClient).then(a => {
        if (!over) {
          over = true;
          resolve();
        }
      });
    });
  } catch (err) {
    log("Unable to propose, skip propose", "warning");
    console.log(err);
  }

  let checkingDataOnChain = false;
  const checkDataOnChain = async () => {
    if (checkingDataOnChain) {
      return;
    }
    checkingDataOnChain = true;

    const unforgeableNameQuery = buildUnforgeableNameQuery(
      JSON.parse(prepareDeployResponse).names[0]
    );

    let dataAtNameResponse;
    try {
      dataAtNameResponse = await rchainToolkit.http.dataAtName(
        httpUrlReadOnly,
        {
          name: unforgeableNameQuery,
          depth: 10
        }
      );
    } catch (err) {
      checkingDataOnChain = false;
      log("Error retreiving transaction data, will retry in 15 seconds");
      console.log(err);
      return;
    }
    checkingDataOnChain = false;

    const parsedResponse = JSON.parse(dataAtNameResponse);

    if (!parsedResponse.exprs.length) {
      log("Cannot retreive transaction data, will retry in 15 seconds");
      return;
    }

    const jsObject = rchainToolkit.utils.rhoValToJs(
      parsedResponse.exprs[0].expr
    );

    log("Files module deployed successfully !");
    log("");
    log(
      `Registry URI (main)         ${jsObject.filesRegistryUri.replace(
        "rho:id:",
        ""
      )}`
    );
    log(
      `Registry URI (add/update)   ${jsObject.entryRegistryUri.replace(
        "rho:id:",
        ""
      )}`
    );
    log(`Nonce                       ${nonce}`);
    log("");
    log(`Now you can use the add_file.js script to add files`);
    log(
      `Example: node add_file --file ./monster.jpg --private-key aaa --registry-uri ${jsObject.entryRegistryUri.replace(
        "rho:id:",
        ""
      )}`
    );
    process.exit();

    /*       rchainToolkit.http
      .exploreDeploy(httpUrlReadOnly, {
        term: `
new return, filesModuleCh, lookup(\`rho:registry:lookup\`), stdout(\`rho:io:stdout\`) in {
  return!(42)
}`
      })
      .then(a => {
        console.log("ok !");
        console.log(a);
        process.exit();
      }); */
  };

  setInterval(checkDataOnChain, 15000);
  checkDataOnChain();
};

main();
