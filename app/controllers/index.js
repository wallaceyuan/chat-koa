/**
 * Created by yuan on 2016/8/15.
 */
// index page
exports.index = function *(next) {
    yield this.render('pages/index')
}