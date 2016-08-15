/**
 * Created by yuan on 2016/8/15.
 */
exports.index = function *(next) {
    yield this.render('pages/chat',{namespance:'',room:''});
}

exports.chatroom = function *(next) {
    var room = this.params.room;
    yield this.render('pages/chat',{namespance:'chatroom',room:room})
}

exports.live = function *(next) {
    var room = this.params.room;
    yield this.render('pages/chat',{namespance:'live',room:room})
}

exports.vod = function *(next) {
    var room = this.params.room;
    yield this.render('pages/chat',{namespance:'vod',room:room})
}

exports.wechat = function *(next) {
    var room = this.params.room;
    yield this.render('pages/chat',{namespance:'broadcast',room:room})
}



