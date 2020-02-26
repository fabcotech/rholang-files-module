const rchainToolkit = require("rchain-toolkit");
const zlib = require("zlib");
const Ajv = require("ajv");
require("dotenv").config();

const { getProcessArgv, log } = require("./utils");

const ajv = new Ajv();
const ASTSchema = {
  schemaId: "string-ast-rholang",
  type: "object",
  properties: {
    expr: {
      type: "object",
      properties: {
        ExprString: {
          type: "object",
          properties: {
            data: {
              type: "string"
            }
          },
          require: ["data"]
        }
      },
      required: ["ExprString"]
    },
    block: {
      type: "object",
      properties: {
        seqNum: {
          type: "number"
        },
        timestamp: {
          type: "number"
        }
      },
      required: ["seqNum", "timestamp"]
    }
  },
  required: ["expr", "block"]
};

const fileSchema = {
  schemaId: "file",
  type: "object",
  properties: {
    mimeType: {
      type: "string"
    },
    name: {
      type: "string"
    },
    data: {
      type: "string"
    },
    signature: {
      type: "string"
    }
  },
  required: ["signature", "data", "mimeType", "name"]
};

ajv.addMetaSchema(require("ajv/lib/refs/json-schema-draft-06.json"));
const validateFile = ajv.compile(fileSchema);

const validateAST = ajv.compile(ASTSchema);

const main = async () => {
  const fileAddress = getProcessArgv("--file-address");

  if (!fileAddress) {
    log("Please provide --file-address (format registry_uri.file_id)");
    process.exit();
  }

  log("host (read-only):           " + process.env.READ_ONLY_HOST);
  log("host (read-only) HTTP port: " + process.env.READ_ONLY_HOST_HTTP_PORT);

  log("Deploying ...");

  const httpUrlReadOnly = `${process.env.READ_ONLY_HOST}:${process.env.READ_ONLY_HOST_HTTP_PORT}`;

  rchainToolkit.http
    .exploreDeploy(httpUrlReadOnly, {
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
    .then(response => {
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response);
      } catch (err) {
        log("failed to JSON.parse response, raw value :", "warning");
        console.log(response);
        process.exit();
      }

      const validAST = validateAST(parsedResponse);
      if (!validAST) {
        log("failed to validate AST, JSON value :", "warning");
        console.log(parsedResponse);
        process.exit();
      }

      let buff;
      try {
        buff = Buffer.from(parsedResponse.data.expr.ExprString.data, "base64");
      } catch (err) {
        log(
          "failed to retreive string from AST (.data.expr.ExprString.data), raw value :",
          "warning"
        );
        console.log(response);
        process.exit();
      }

      const unzippedBuffer = zlib.gunzipSync(buff);
      file = unzippedBuffer.toString("utf-8");

      const validFile = validateFile(parsedResponse.data);
      if (!validFile) {
        log("failed to validate file, JSON value :", "warning");
        console.log(file);
        process.exit();
      }
    });
};

main();
