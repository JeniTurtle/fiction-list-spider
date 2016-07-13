var fs = require('fs');
var _path = require('path');

exports.route = function () {
    /// 添加配置
    routes.post('/config/add', function (req, res) {
        var self = this;
        req.post.child = req.post.child && JSON.parse(req.post.child);
        req.post.contentSelector = req.post.contentSelector && JSON.parse(req.post.contentSelector);
        var filename = ROOT + 'config/' + req.post.configName.trim();
        req.post.isPagination = req.post.isPagination == 1 ? 1 : 0;
        delete req.post.configName;
        if (req.post.isPagination === 0) {
            req.post.from = 1;
            req.post.to = 1;
        }
        fs.writeFile(filename, JSON.stringify(req.post), function (err) {
            self.json({
                status: !err,
                info: !err ? '保存成功':'保存失败',
                error: err
            });
        });
    });
    
    /// 删除配置
    routes.get('/config/delete', function (req, res) {
        var self = this;
        fs.unlink(ROOT + 'config/' + req.get.name, function (err) {
            self.json({
                status: !err,
                info: !err?'删除成功':'删除失败',
                error: err
            });
        });
    });
    
    /// 获取配置内容
    routes.get('/config/edit', function (req, res) {
        var self = this;
        var filename = _path.join(ROOT, 'config', req.get.name);
        fs.readFile(filename, { encoding: 'utf8' }, function (err, data) {
            if (err) {
                self.json({
                    status: false,
                    info: '该配置文件不存在'
                });
            } else {
                self.json({
                    status: true,
                    data: utils.extend(JSON.parse(data), { configName: req.get.name })
                });
            }
        });
    });
}