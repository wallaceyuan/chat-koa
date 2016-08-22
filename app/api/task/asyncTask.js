var config = require('./config');
var client  = config.client;
var user = require('./user');
var iconv = require('iconv-lite');
var moment = require('moment');
var wrapper = require('co-redis');
var client  = config.client;
var redisCo = wrapper(client);
var asy = {};

asy.Violator = function(done,data){
	if(data.token){
		user.userViolatorRedis({token:data.token},function(err,res){
			console.log('evolidate');
			done(err,res);
		});
	}
	if(data.openid){
		user.userViolatorWechatRedis({openid:data.openid},function(err,res){
			console.log('evolidate');
			done(err,res);
		});
	}
}

asy.Allowed = function(arg,done,data){
	if(data.openid){
		var data = {
			"uid":1,
			"tel":1,
			"openid":data.openid,
			"posterURL":data.posterURL,
			"nickName":data.nickName
		};
		var res = {
			"data":JSON.stringify(data)
		};
		done(null,res);
	}
	if(data.token){
		user.userAllowedRedis({token:data.token},function(err,res){
			console.log('eallow');
			done(err,res);
		});
	}
}

asy.historyData = function(room,socket){
	client.LRANGE('messageKKDM'+room,0,10,function(err, objs){
		if(err){
			console.log(err);
		}else{
			objs = objs.map(function(obj){
				try{
					var rObj = JSON.parse(obj);
					return rObj;
				}catch(e){
					console.log(e);
				}
			});
			socket.emit('historyData',{history:objs.reverse()});
		}
	});
}

asy.getRoomPeople = function *(chat,sid){
	try{
		var obj = yield redisCo.HGETALL(chat.keyRoom[sid]);
		if(obj){
			var userBox = [];
			for(var key in obj){
				if(!key.match(/time/)){
					userBox.push(JSON.parse(obj[key]));
				}
			}
			users = userBox;
		}else{
			users = [];
		}
		return users
	}catch(err){
		console.log(err);
	}
}


asy.userInit = function *(err,res,socket,sid,data,chat){

	var users = yield asy.getRoomPeople(chat,sid)

	if(err){
		console.log('-------------',err,'-------------');
		var val = yield redisCo.get(chat.key[sid])
		if(parseInt(val) < 1){
			client.set(chat.key[sid], 0);
			onlinesum = 0;
		}else{
			onlinesum = parseInt(val);
		}
		chat.black[sid] = true,chat.roomName[sid] = data.room,chat.clients[sid] = socket;
		socket.emit('userWebStatus',{status:err.code,msg:err.msg,users:users,onlinesum:onlinesum});
		socket.emit('userStatus',{status:err.code,msg:err.msg});
		asy.historyData(chat.NSP[sid]+roomName,socket);
	}else{
		chat.black[sid] = false;
		var openid,token,uif;/*将数组封装成用户信息*/
		try{
			uif = JSON.parse(res.data);
		}catch(e){
			socket.emit('userStatus',{status: 705, msg: "参数传入错误2"});
			return;
		}
		chat.roomName[sid] = data.room, chat.userName[sid] = uif.nickName,chat.clients[sid] = socket;
		//console.log('chat.roomName[sid]',chat.roomName[sid])
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

		var val = yield redisCo.incr(chat.key[sid])
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
		redisCo.HMSET(chat.keyRoom[sid],chat.userCode[sid],JSON.stringify(chat.userData[sid]))
		socket.emit('userStatus',{status:0,msg:'用户验证成功',userData:{nickName:chat.userName[sid],posterURL:uif.posterURL}});
		socket.emit('userWebStatus',{status:0,msg:'用户验证成功',userData:chat.userData[sid],users:users,onlinesum:onlinesum});
		asy.historyData(chat.NSP[sid]+chat.roomName[sid],socket);
	}
}

module.exports = asy