const serverless = require("serverless-http");
const Koa = require("koa");
const route = require("koa-route");
const compress = require("koa-compress");
const { bodyParser } = require("@koa/bodyparser");

// Custom log forwarder code
const { SeverityNumber } = require('@opentelemetry/api-logs');
const {
    LoggerProvider,
    BatchLogRecordProcessor,
  } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');

const collectorOptions = {
    url: 'https://otlp.nr-data.net:4318/v1/logs', // url is optional and can be omitted - default is http://localhost:4318/v1/logs
    concurrencyLimit: 1, // an optional limit on pending requests
  };

const logExporter = new OTLPLogExporter(collectorOptions);
const loggerProvider = new LoggerProvider();

loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
const logger = loggerProvider.getLogger('default', '1.0.0');

//app started
const app = (module.exports = new Koa());
app.use(compress());
app.use(bodyParser({
  enableTypes: ['json', 'text']
}));

const API_CONFIG = {
  baseURL: process.env.EXPRESS_OTEL_API_ENDPOINT
};

app.use(
  route.get("/", async function (ctx) {
    ctx.body = "Hello World";
  })
);

app.use(
  route.get("/path", async function (ctx) {
    ctx.body = "Hello from path";
  })
);

app.use(
  route.post("/", async function (ctx) {
    ctx.body = ctx.request.body || "Hello from POST";
  })
);

app.use(
  route.get("/weather", async function (ctx, next) {
    var axios = require("axios");

    var config = {
      method: "get",
      url: `${API_CONFIG.baseURL}/weather?location=${ctx.request.query.location}`,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // emit a log record
    logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'info',
        body: 'this is a log body',
        attributes: { 'log.type': 'custom' },
      });

    console.log(`config: ${JSON.stringify(config)}`);
    // var config = {
    //   method: "get",
    //   url: `${API_CONFIG.baseURL}/weather?q=${ctx.request.query.location}&appid=${API_CONFIG.TOKEN}`,
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    // };

    return await axios(config)
      .then(function (response) {
        console.info(
          `${ctx.request.method} ${ctx.request.originalUrl}- ${JSON.stringify(
            ctx.request.query.location
          )} - Request Successful!!`
        );
        ctx.body = response.data;
        next();
      })
      .catch(function (error) {
        console.error(
          `${ctx.request.method} ${ctx.request.originalUrl}- ${JSON.stringify(
            ctx.request.query.location
          )} - Error fetching data`
        );
        ctx.throw(404,`Error retrieving data, ${ctx.request.query?.location} ${error.message}`)
      });
  })
);


if (!module.parent) app.listen(3000);

module.exports.handler = serverless(app);

