
var config = require('../task/config');
var socketF = require('./socketfunc');
var chat = require('../../../routes/chat');


var redis = require('socket.io-redis');

var client = config.client;
var host = config.host;

exports.socketio = function(server) {

    var io = require('socket.io')(server);

    io.adapter(redis({host: host, port: 6379}));

    var nameBox = ['/chatroom','/live','/vod','/wechat','/broadcast'];

    for(var item in nameBox){

        var lnsp = io.of(nameBox[item]);

        //chat.initialize(io,lnsp);
        socketF.socketHallFuc(lnsp,client);
    }

    //chat.initialize(io,'/live');


}
