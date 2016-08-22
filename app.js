
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
app.keys = ['secret1'];
app.use(session(app));
//视图
app.use(views(__dirname + '/app/views', { map: {html: 'ejs' }}))
app.use(staticServer(path.join(__dirname, 'public')));


app.use(function *(next){
    yield next
});

//错误处理机制
/*app.use(function *() {
    throw new Error();
});*/


//路由
require('./config/routes')(router)

app
    .use(router.routes())
    .use(router.allowedMethods())

//socket
var server = require('http').createServer(app.callback());

var socket = require('./app/api/socket/socket')

socket.socketio(server);

server.listen(3000);

console.log('Listening');

var config = require('./config/config');

var client = config.client;

client.keys('KKDanMaKuOnlineUser*', function (err, obj) {
    if(err){
        console.log(err);
        res.send('err');
        return;
    }else{
        if(obj.length > 0){
            for(var i = 0;i<obj.length;i++){
                client.DEL(obj[i]);
            }
        }
    }
});

client.keys('RoomPeopleDetail*', function (err, obj) {
    if(err){
        console.log(err);
        res.send('err');
        return;
    }else{
        if(obj.length > 0){
            for(var i = 0;i<obj.length;i++){
                client.DEL(obj[i]);
            }
        }
    }
});
