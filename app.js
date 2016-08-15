
'use strict'

var Koa = require('koa');
var fs = require('fs')
var app = new Koa();
var path = require('path');
var session = require('koa-session')
var bodyParser = require('koa-bodyparser');
var views = require('koa-views')
var Router = require('koa-router');
var router = new Router()
var moment = require('moment')
var staticServer = require('koa-static');
var http = require('http');

app.use(bodyParser());

//йсм╪
app.use(views(__dirname + '/app/views'/*, { map: {html: 'nunjucks' }}*/))
app.use(staticServer(path.join(__dirname, 'public')));

app.use(function *(next){
    yield next
});

//б╥си
require('./config/routes')(router)

app
    .use(router.routes())
    .use(router.allowedMethods())

//socket
var server = require('http').Server(app.callback());
/*var socket = require('./app/api/socket/socket')
socket.socketio(server);*/
//var io = require('socket.io')(server);


//main processing file
var chat = require('./routes/chat');


chat.initialize(server);


server.listen(3000);

console.log('Listening');

