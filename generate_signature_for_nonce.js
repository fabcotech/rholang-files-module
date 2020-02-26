const rchainToolkit = require("rchain-toolkit");
const { blake2b } = require("blakejs");

/*
  This script will output the signature required by the names.rho contract to
  update a record on chain
*/

/*
  PRIVATE_KEY: string;
  Private key that corresponds to the public key of the record you wish to update
*/
const PRIVATE_KEY =
  "ea9833452278515ecebffbbebb9b6ffc926caf68af06d7963795a409783b9167";
/*
  NONCE: string;
  Nonce of the record you wish to update
*/
const NONCE = "c211286f65fa4d20ab9583bb4fe1c407";

const bufferToSign = Buffer.from(NONCE, "utf8");
const uInt8Array = new Uint8Array(bufferToSign);

const blake2bHash = blake2b(uInt8Array, 0, 32);

const signature = rchainToolkit.utils.signSecp256k1(blake2bHash, PRIVATE_KEY);

const signatureHex = Buffer.from(signature).toString("hex");

console.log("SIGNATURE :", signatureHex);
