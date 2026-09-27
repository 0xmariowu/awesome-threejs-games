// Local archive wrapper. The upstream game files are not modified.
const path = require('node:path');
const config = require('./local.json');

import('../tools/server.mjs').then(({ createServer }) => {
  const port = Number(process.env.PORT || config.port);
  const server = createServer(path.join(__dirname, config.root), config.entry);
  server.on('error', error => {
    console.error(`Cannot start ${path.basename(__dirname)} on 127.0.0.1:${port}: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Local game: http://127.0.0.1:${server.address().port}/`);
  });
}).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
