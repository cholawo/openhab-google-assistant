const express = require('express');

const app = express();
const openhabGA = require('./functions/index.js');
const ApiHandler = require('./functions/apihandler.js');
const config = require('./functions/config.js');

const apiHandler = new ApiHandler({
  host: config.host,
  port: config.port,
  path: config.path
});

app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await apiHandler.getItems();
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    if (error.statusCode) {
      res.status(200).json({ status: 'ok' });
      return;
    }
    res.status(503).json({ status: 'error' });
  }
});

app.use('/', (req, res) => {
  openhabGA.openhabGoogleAssistant(req, res);
});

const port = process.env.OH_SERVER_PORT || 3000;
app.listen(port, () => {
  console.log('Server is listening on port %s', port);
});
