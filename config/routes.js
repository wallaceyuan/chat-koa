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

}