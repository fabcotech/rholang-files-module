const rchainToolkit = require("rchain-toolkit");
require("dotenv").config();

const rnodeHttpUrl = `${process.env.HOST}:${process.env.HTTP_PORT}`;

const main = async () => {
  rchainToolkit.http
    .exploreDeploy(rnodeHttpUrl, {
      term: `
new return, filesModuleCh, lookup(\`rho:registry:lookup\`), stdout(\`rho:io:stdout\`) in {

  lookup!(\`rho:id:1uoz65935t18sqghnfbud77w98gjzw15zea5xbczjscqcjrhrmtjcr\`, *filesModuleCh) |

  for(filesModule <- filesModuleCh) {
    return!(*filesModule)
  }
}`
    })
    .then(a => {
      console.log("ok !");
      console.log(a);
    });
};

main();
