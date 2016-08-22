var redis = require('redis');
var request = require('request');
var async = require('async');
var debug = require('debug')('socketfunc:save');
var moment = require('moment');
var user = require('../task/user');
var config = require('../task/config');
var asy = require('../task/asyncTask.js');
var co = require('co')
var wrapper = require('co-redis');
var _ = require('lodash')

var onlinesum = 0;
var users = [];//在线users
//var clients = [];//在线socket
var client  = config.client;
var redisCo = wrapper(client);

var keyPrim = "KKDanMaKuOnlineUser"
var chat = {};
chat.nsp = {};
chat.userCode = {}
chat.clients = {}
chat.black = {}
chat.roomName = {},chat.userData = {},chat.userName = {}
chat.NSP = {}, chat.key = {};//在线人数key
chat.keyRoom = {};//房间人数key

chat.socketHallFuc = function * (nsp,client) {
    yield this.socketMain(nsp,client);
}

chat.socketMain = function * (nsp,client){

    var that = this

    nsp.on('connection',function (socket){
        //console.log('connection');
        if(!nsp.name){
            return
        }

        var NSP = nsp.name == '/'?'root': nsp.name.replace(/\//g, "")

        chat.nsp[socket.id] = nsp;

        chat.NSP[socket.id] = NSP;

        that.userInit(socket)

        /*订阅房间*/
        that.subscribe(socket)

        /*取消订阅房间*/
        that.unsubscribe(socket)

        /*接收redis发来的消息*/
        that.redisCome(socket)

        /*接收redis错误信息返回*/
        that.messageError(socket)

        /*用户发送消息*/
        that.createMessage(socket)

        /*用户下线*/
        that.disconnect(socket)

        that.onlineRequest(socket);

    });

}

chat.unsubscribe = function(socket){
    socket.on('unsubscribe', function(data) {
        var roomName = data.room;
        if(roomName == "" || roomName == null){
            console.log("empty Room");
        }else{
            socket.leave(data.room);
        }
    });
}

chat.subscribe = function(socket){
    socket.on('subscribe', function(data) {
        var roomID = data.room;
        if(roomID == "" || roomID == null){
            //console.log("empty Room");
        }else{
            socket.join(data.room);
            // console.log(socket.id,'subscribe',roomID);
        }
    });
}

chat.createMessage = function(socket){
    socket.on('createMessage',function(data){
        var sid = socket.id
        if(chat.black[sid]){
            return
        }else{
            try{
                var data2 = {socketid:chat.userData[sid].id,cid: chat.roomName[sid], openid: '',checked:0,violate:0,createTime:moment().unix(), place:chat.NSP[sid]+':'+chat.roomName[sid]};
                data = _.assignIn(data,chat.userData[sid],data2);
            }catch(e){
                console.log('client create message err');
                return;
            }
            data.message = String(data.message).trim();
            console.log('socketid',data.socketid,'message',data.message);
            if(data.perform){
                try{
                    data.perform = JSON.stringify(data.perform);
                }catch(e){
                    data.perform = '';
                }
            }
            client.lpush('message',JSON.stringify(data),redis.print);
        }
    });
}

chat.disconnect = function(socket){
    socket.on('disconnect', function () {

        var sid = socket.id

        var quweyFlag = true;

        if(!chat.userData[sid]){
            return
        }

        if(socket.id)
            delete chat.clients[socket.id];

        console.log('leave socket',socket.id);

        socket.leave(chat.roomName[sid]);

        var queryLey = chat.userCode[sid].split('time')[0];

        co(function *(){

            yield redisCo.HDEL(chat.keyRoom[sid],chat.userCode[sid]);

            var obj = yield redisCo.HGETALL(chat.keyRoom[sid])
            if(obj){
                for(var keypeople in obj){
                    if(keypeople.split('time')[0] == queryLey){
                        quweyFlag = false;
                    }
                }
            }
            var val = yield redisCo.decr(chat.key[sid])
            if(parseInt(val) < 1) client.set(chat.key[sid], 0);
            onlinesum = val;
            if(quweyFlag){
                var res = {id:socket.id,user:chat.userName[sid],content:'下线了',onlinesum:onlinesum}
                if(chat.roomName[sid]!=''){
                    socket.broadcast.in(chat.roomName[sid]).emit('people.del', res);
                }else{
                    socket.broadcast.emit('people.del', res);
                }
            }else{
                if(chat.roomName[sid]!=''){
                    socket.broadcast.in(chat.roomName[sid]).emit('people.del', {onlinesum:onlinesum});
                }else{
                    socket.broadcast.emit('people.del', {onlinesum:onlinesum});
                }
            }
        })
    });
}

chat.userInit = function (socket){
    socket.on('userInit',function (data){//监听 客户端的消息
        console.log('userInit');
        var sid = socket.id
        console.log('socketid-----------------------'+socket.id);
        console.log('token-----------------------'+data.token);
        console.log('openid-----------------------'+data.openid);
        console.log('nsp-------------------------'+chat.nsp[sid].name);
        console.log('room------------------------'+data.room);

        if(chat.nsp[sid] == null || data.room == null){
            socket.emit('message.error',{status: 705, msg: "参数传入错误1"});
            return;
        }
        chat.key[sid] = keyPrim + chat.NSP[sid]+data.room;
        chat.keyRoom[sid] = 'RoomPeopleDetail'+chat.NSP[sid]+data.room;

        co(function *(){
            if(data.room!=''){
                socket.join(data.room);
            }
            async.waterfall([
                function(done){//用code查询是否被禁言(redis)
                    console.log('-------------svolidate-------------');
                    asy.Violator(done,data);
                },
                function(arg,done){//用code检测时候是allow用户（redis/sso）
                    console.log('sallow');
                    asy.Allowed(arg,done,data);
                },
            ],function(err,res){
                co( function *(){
                    yield asy.userInit(err,res,socket,sid,data,chat)
                })
                console.log('-------------asy success-------------'/*,res*/);
                //debug('所有的任务完成了',res);
            });
        })
    });
}

chat.onlineRequest = function(socket){
    socket.on('onlineRequest',function(data){
        var key = data.key;
        co(function *(){
            var val = redisCo.get(key)
            if(parseInt(val) < 1){
                client.set(key, 0);
                onlinesum = 0;
            }else{
                onlinesum = parseInt(val);
            }
            socket.emit('giveOnline',{onlinesum:onlinesum});
        })
    });
}

chat.redisCome = function(socket){
    socket.on('redisCome',function (data) {
        var sid = socket.id
        console.log('-------------redisCome',data.message);
        try{
            var msgInfo = {"message":data.message,"createTime":data.createTime,
                "type":data.type,"up":data.up,
                "down":data.down,"perform":data.perform,
                "nickName":data.nickName,"posterURL":data.posterURL
            }
        }catch(e){
            var msgInfo = {};
        }
        if(data.room!=''){
            chat.nsp[sid].in(data.room).emit('message.add',msgInfo);
        }else{
            chat.nsp[sid].emit('message.add',msgInfo);
        }
    });
}

chat.messageError = function(socket){
    socket.on('messageError',function(data){
        console.log('messageError',data,data.socketid);
        try{
            var errSocket = chat.clients[data.socketid];
            var err = {status:data.status,msg:data.msg}
            console.log('-------------messageError-errSocket-------------',data.socketid);
            if(errSocket){
                if(data.room!=''){
                    errSocket.emit('message.error',err);
                }else{
                    errSocket.emit('message.error',err);
                }
            }
        }catch(e){

        }
    });
}

module.exports = chat;