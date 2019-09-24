const Koa = require('koa');
const Router = require('koa-router');
const views = require('koa-views');
const json = require('koa-json');
const onerror = require('koa-onerror');
const bodyparser = require('koa-bodyparser');
const session = require('koa-session');
const logger = require('koa-logger');
const cors = require('koa2-cors'); // 解决跨域的中间件 koa2-cors
// 导入数据库连接文件
const { connect } = require('./utils/connect');
// 导入业务逻辑文件
const initDataService = require('./service/initData');
// 导入路由文件
const goods = require('./routes/goods');
const search = require('./routes/search');
const user = require('./routes/user');

const app = new Koa();
const router = new Router();

app.proxy = true; // 设置一些 proxy header 参数会被加到信任列表中
app.keys = [ 'session secret' ]; // 设置签名的 Cookie 密钥
// error handler
onerror(app);
// session 配置
const CONFIG = {
  key: 'sessionId',
  maxAge: 60000, // cookie 的过期时间 60000ms => 60s => 1min
  overwrite: true, // 是否可以 overwrite (默认 default true)
  httpOnly: true, // true 表示只有服务器端可以获取 cookie
  signed: true, // 默认 签名
  rolling: false, // 在每次请求时强行设置 cookie，这将重置 cookie 过期时间（默认：false）
  renew: false, // 在每次请求时强行设置 session，这将重置 session 过期时间（默认：false）
};
app.use(session(CONFIG, app));
app.use(cors({
  origin: function(ctx) {
    return ctx.header.origin
  }, // 允许发来请求的域名
  credentials: true, // 标示该响应是合法的
}));
// middlewares
app.use(bodyparser({
  enableTypes:['json', 'form', 'text']
}));
app.use(json());
app.use(logger());
app.use(require('koa-static')(__dirname + '/public'));
app.use(views(__dirname + '/views', {
  extension: 'ejs'
}));

// logger
app.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});
// 主要执行初始化数据任务逻辑 | 访问 localhost:3000 执行数据导入任务
app.use(async (ctx, next) => {
  const url = ctx.request.url;
  if (url == '/') {
    let res = await initDataService.index();
    ctx.body = res;
  }
  await next();
});

// 装载所有子路由
router.use('/api', search.routes()); // 搜索
router.use('/api/goods', goods.routes()); // 商品
router.use('/api/user', user.routes()); // 用户
// 加载路由中间件
app.use(router.routes())
   .use(router.allowedMethods());

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx);
});

// 立即执行函数
(async () => {
  await connect(); // 执行连接数据库函数
})();

module.exports = app;
