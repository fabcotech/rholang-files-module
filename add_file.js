const fs = require("fs");
const zlib = require("zlib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const rchainToolkit = require("rchain-toolkit");
const uuidv4 = require("uuid/v4");
require("dotenv").config();

const {
  extToMimeType,
  getProcessArgv,
  createSignature,
  createFile,
  createNonceSignature,
  log
} = require("./utils");

const pushFile = async () => {
  const privateKey = getProcessArgv("--private-key");

  if (!privateKey) {
    log("Please provide --private-key cli parameters", "error");
    process.exit();
  }

  const publicKey = rchainToolkit.utils.publicKeyFromPrivateKey(privateKey);

  let registryUri = getProcessArgv("--registry-uri");
  if (!registryUri) {
    log("Please provide --registry-uri parameter", "error");
    process.exit();
  }

  let fileId = getProcessArgv("--file-id");
  if (!fileId) {
    log('--file-id parameter not provided, will try default value "index"');
    fileId = "index";
  }
  if (fileId === "RANDOM") {
    fileId = uuidv4()
      .replace(/-/g, "")
      .substr(0, 8);
    log("--file-id randomly generated : " + fileId);
  }

  let phloLimit = getProcessArgv("--phlo-limit");
  if (!phloLimit) {
    log("default phlo limit to " + 1000000);
    phloLimit = 1000000;
  } else {
    phloLimit = parseInt(phloLimit);
  }

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

  const addFile = fs.readFileSync(`add_file.rho`, "utf8");

  const filePath = getProcessArgv("--file");
  if (!filePath) {
    log("--file argument not found", "error");
    process.exit();
  }

  let fileToPush;
  try {
    fileToPush = fs.readFileSync(filePath);
  } catch (err) {
    log(`${filePath} not found in the directory`, "error");
    process.exit();
  }

  let mimeType = getProcessArgv("--mime-type");
  if (!mimeType) {
    log(
      `mimeType argument will be based on the extension of the file ${filePath}`
    );
  }

  const pathSplitted = filePath.split(".");
  const extension = pathSplitted[pathSplitted.length - 1];
  if (!mimeType) {
    mimeType =
      extToMimeType(extension) ||
      extToMimeType(extension.toLowerCase()) ||
      extToMimeType(extension.toUpperCase());
    if (!mimeType) {
      log(
        `Could not infer mimeType based on extension ${extension}, please set a mimeType using the --mime-type parameter`,
        "error"
      );
      process.exit();
    }
  }

  const pathsSPlitted = filePath.split("/");
  const name = pathsSPlitted[pathsSPlitted.length - 1];

  const fileAsString = fileToPush.toString("base64");
  const signature = createSignature(fileAsString, mimeType, name, privateKey);
  const file = createFile(fileAsString, mimeType, name, signature);
  const fileGZipped = zlib.gzipSync(file).toString("base64");

  const pushFileOnChain = async () => {
    const timestamp = new Date().valueOf();

    const grpcProposeClient = await rchainToolkit.grpc.getGrpcProposeClient(
      grpcUrlValidator,
      grpc,
      protoLoader
    );

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

    const nonce = "4219908afd2a4b739f44f3dfd3f278c8"; // uuidv4().replace(/-/g, "");
    const term = addFile
      .replace("FILE_BASE64", fileGZipped)
      .replace("FILE_ID", fileId)
      .replace("REGISTRY_URI", registryUri)
      .replace("NONCE", nonce)
      .replace("SIGNATURE", createNonceSignature(nonce, privateKey));

    const phloPrice = 1;

    const deployOptions = await rchainToolkit.utils.getDeployOptions(
      "secp256k1",
      timestamp,
      term,
      privateKey,
      publicKey,
      phloPrice,
      phloLimit,
      validAfterBlockNumber || -1
    );

    try {
      await rchainToolkit.http.deploy(httpUrlValidator, deployOptions);
    } catch (err) {
      log("Unable to deploy");
      console.log(err);
      process.exit();
    }
    log("Deployed add_file.rho");

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

    log(`Deploy and propose successful !`);
    log(`File address ${registryUri}.${fileId}`);
    process.exit();
  };

  pushFileOnChain();
};

pushFile();
