/**
 * Created by yuan on 2016/8/15.
 */
'use strict'

var Index = require('../app/controllers/index')
var Chat = require('../app/controllers/chat')


module.exports = function(router) {

    router.get('/', Index.index)

    router.get('/chats',Chat.index);

    router.get('/chats/chatroom/:room',Chat.chatroom);

    router.get('/chats/live/:room',Chat.live);

    router.get('/chats/vod/:room',Chat.vod);

    router.get('/chats/wechat/:room',Chat.wechat);

    router.get('/chats/broadcast/:room',Chat.wechat);

    /*
    router.route('/user/get').post(function(req,res){
        console.log('post-code',req.body.code);
        User.findById({code:req.body.code},function(err,user){
            if(user.length == 0){
                res.send({
                    "code": 400,
                    "msg": "fail"
                });
            }else{
                res.send({
                    "code": 0,
                    "msg": "success",
                    "data": JSON.stringify(user[0])
                });
            }
        });
    });

    router.route('/message/valide').post(function(req,res){
        console.log('post-message',req.body.message);

        User.findById({code:req.body.code},function(err,user){
            if(user.length == 0){
                res.send({
                    "code": 400,
                    "msg": "fail"
                });
            }else{
                res.send({
                    "code": 0,
                    "msg": "success",
                    "data": JSON.stringify(user[0])
                });
            }
        });
    });*/
}