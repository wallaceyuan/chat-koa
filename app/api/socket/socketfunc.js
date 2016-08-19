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


var onlinesum = 0;
var users = [];//在线users
var clients = [];//在线socket
var client  = config.client;
var redisCo = wrapper(client);

var keyPrim = "KKDanMaKuOnlineUser"
var chat = {};
chat.nsp = {};
chat.userCode = {}
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
        roomName = data.room;
        if(roomName == "" || roomName == null){
            console.log("empty Room");
        }else{
            socket.leave(data.room);
        }
    });
}

chat.subscribe = function(socket){
    socket.on('subscribe', function(data) {
        roomID = data.room;
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
                for(var item in chat.userData[sid]){
                    data2[item]=chat.userData[sid][item];
                }
                for(var item in data2){
                    data[item]=data2[item];
                }
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
        client.HDEL(chat.keyRoom[sid],chat.userCode[sid],function(err, replies){
            if(err){
                console.log(err);
            }else{
                //console.log('userCode',userCode,replies);
            }
        });

        if(socket.id)
            delete clients[socket.id];

        console.log('leave socket',socket.id);

        socket.leave(chat.roomName[sid]);

        var queryLey = chat.userCode[sid].split('time')[0];

        client.HGETALL(chat.keyRoom[sid],function(err, obj){
            if(err){
                console.log(err);
            }else{
                if(obj){
                    for(var keypeople in obj){
                        if(keypeople.split('time')[0] == queryLey){
                            quweyFlag = false;
                        }
                    }
                }
            }

            client.decr(chat.key[sid], function(error, val){
                if(parseInt(val) < 1) client.set(chat.key[sid], 0);
                onlinesum = val;
                if(quweyFlag){
                    if(chat.roomName[sid]!=''){
                        socket.broadcast.in(chat.roomName[sid]).emit('people.del', {id:socket.id,user:chat.userName[sid],content:'下线了',onlinesum:onlinesum});
                    }else{
                        socket.broadcast.emit('people.del', {id:socket.id,user:chat.userName[sid],content:'下线了',onlinesum:onlinesum});
                    }
                }else{
                    if(chat.roomName[sid]!=''){
                        socket.broadcast.in(chat.roomName[sid]).emit('people.del', {onlinesum:onlinesum});
                    }else{
                        socket.broadcast.emit('people.del', {onlinesum:onlinesum});
                    }
                }
            });
        });
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
            var users = yield asy.getRoomPeople(chat,sid)
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
                if(err){
                    console.log('-------------',err,'-------------');
                    co(function *(){
                        var val = yield redisCo.get(chat.key[sid])
                        if(parseInt(val) < 1){
                            client.set(chat.key[sid], 0);
                            onlinesum = 0;
                        }else{
                            onlinesum = parseInt(val);
                        }
                        chat.black[sid] = true,chat.roomName[sid] = data.room,clients[sid] = socket;
                        socket.emit('userWebStatus',{status:err.code,msg:err.msg,users:users,onlinesum:onlinesum});
                        socket.emit('userStatus',{status:err.code,msg:err.msg});
                        asy.historyData(chat.NSP[sid]+roomName,socket);
                    })
                }else{
                    chat.black[sid] = false;var uif;/*将数组封装成用户信息*/
                    var openid,token;
                    try{
                        uif = JSON.parse(res.data);
                    }catch(e){
                        socket.emit('userStatus',{status: 705, msg: "参数传入错误2"});
                        return;
                    }
                    chat.roomName[sid] = data.room, chat.userName[sid] = uif.nickName,clients[sid] = socket;
                    if(data.openid){
                        openid = data.openid,token = '';
                    }else{
                        openid = '',token = data.token;
                    }

                    /*判断重复用户*/
                    var judge = users.filter(function(user){
                        if(user){
                            if(parseInt(uif.uid) == 1){
                                return chat.roomName[sid] == user.room && uif.openid == user.openid;
                            }else{
                                return chat.roomName[sid] == user.room && uif.uid == user.uid;
                            }
                        }
                    });


                    client.incr(chat.key[sid], function(error, val){
                        onlinesum = val;
                        chat.userData[sid] = {"token":token,"openid":openid,"id": socket.id,"room":chat.roomName[sid],"posterURL":uif.posterURL,
                            "tel":uif.tel,"uid":uif.uid,"nickName":chat.userName[sid],"onlinesum":onlinesum};
                        if(data.token){
                            users = users.filter(function (user) {
                                return user.uid != uif.uid
                            });
                        }else{
                            users = users.filter(function (user) {
                                return user.openid != openid
                            });
                        }

                        users.push(chat.userData[sid]);

                        var uifD = openid?openid:uif.uid;
                        if(judge.length == 0){
                            chat.userCode[sid] = uifD;
                            if(chat.roomName[sid]!=''){
                                socket.broadcast.in(chat.roomName[sid]).emit('joinChat',chat.userData[sid]);
                            }else{
                                socket.broadcast.emit('joinChat',chat.userData[sid]);
                            }
                        }else{
                            chat.userCode[sid] = uifD+'time'+moment().unix();
                            if(chat.roomName[sid]!=''){
                                socket.broadcast.in(chat.roomName[sid]).emit('joinChat',{onlinesum:val});
                            }else{
                                socket.broadcast.emit('joinChat',{onlinesum:val});
                            }
                        }

                        client.HMSET(chat.keyRoom[sid],chat.userCode[sid],JSON.stringify(chat.userData[sid]),function(err, replies){
                            if(err){
                                console.log(err);
                            }else{
                                console.log(replies);
                            }
                        });
                        socket.emit('userStatus',{status:0,msg:'用户验证成功',userData:{nickName:chat.userName[sid],posterURL:uif.posterURL}});
                        socket.emit('userWebStatus',{status:0,msg:'用户验证成功',userData:chat.userData[sid],users:users,onlinesum:onlinesum});
                        asy.historyData(chat.NSP[sid]+chat.roomName[sid],socket);
                    });
                }
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
            var errSocket = clients[data.socketid];
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