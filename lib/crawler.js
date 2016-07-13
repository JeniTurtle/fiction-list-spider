/// 依赖模块
var fs = require('fs');
var request = require("request");
var cheerio = require("cheerio");
var mkdirp = require('mkdirp');
var iconv = require('iconv-lite');
var async = require('async');
var color = require('./color.js');
var utils = require('./utils.js');
var path = require('path');
var URL = require('url');

var configFile;
var config;/// 所选配置文件
var rooturl;
var rootsite;
var hostname;
var log;

/// 监听主进程发送过来的信息
process.on('message', function (m) {
    fs.readFile(path.normalize(__dirname + '/../config/' + m), function (err, data) {
        if (err) {
            console.log(err)
            log('读取配置文件失败', 'red');
            return;
        }
        configFile = m;
        config = JSON.parse(data);
        rooturl = config.isPagination ? function (i) { return config.url.replace('%%', i); }:config.url;
        rootsite = config.url.match(/[^\.]+[^/]+/)[0];
        hostname = URL.parse(rootsite).hostname;
        log('抓取' + rootsite + '中', 'blueBG');
        new Crawler().crawl();
    });
});

var Crawler = function () {
    this.saveDir = path.join(__dirname, '../download');
    this.level = 1; /// 当前抓取层级
    this.result = []; /// 数据结果集
    this.from = config.from || 1;
    this.to = config.to || 1;
};

/// 开始处理的入口
Crawler.prototype.crawl = function () {
    var that = this;
    that.log('程序正在执行中...');
    that.start();
};

///抓取第一层内容
Crawler.prototype.start = function() {
    var that = this;
    that.log('开始抓取' + that.level + '级页面内容...');

    var i = config.from;
    async.whilst(function () {
        return i <= config.to;
    }, function (_callback) {
        that.request(rooturl(i), function (status, $) {
            if (status) {
                that.log('正在抓取第' + i + '页内容...');
                that.content($, config);

            } else {
                that.log(rooturl(i) + '请求失败', 'red');
            }
            setTimeout(function () {
                ++i;
                _callback(null);
            }, parseInt(Math.random() * 2000));
        });
    }, function (err) {
        if (err) {
            that.log(err, 'red');
        } else {
            that.log('所有一级页面抓取完成，共收集到了' + that.result.length + '条数据', 'green');
            !!config.child ? that.repeat(config.child) : that.writeFile();
        }
    });
}

///抓取第N层内容
Crawler.prototype.repeat = function(config) {
    var that = this;
    that.level += 1;
    that.log('开始抓取' + that.level + '级页面内容...');

    async.eachOfSeries(that.result, function (item, key, _callback) {
        var url = item[config.urlField];
        if (!/^http:\/\//i.test(url)) {
            url = rootsite + url;
        }

        that.request(url, function (status, $) {
            if (status) {
                that.log('正在抓取第' + key + '条内容...');
                that.content($, config, key);

            } else {
                that.log(url + '请求失败', 'red');
            }
            setTimeout(function () {
                ++key;
                _callback(null);
            }, parseInt(Math.random() * 2000));
        });
    }, function (err) {
        if (err) {
            that.log(err, 'red');
        } else {
            that.log('所有' + that.level + '级页面抓取完成，共收集到了' + that.result.length + '条数据', 'green');
            !!config.child ? that.repeat(config.child) : that.writeFile();
        }
    });
}

/// 抓取内容
Crawler.prototype.content = function($, config, updateKey) {

    var that = this,
        index,
        selectorItem,
        contentData,
        $rootSelector = config.rootSelector ? $(config.rootSelector) : {
            each: function(fn) {
                fn.call(null, 0);
            }
        };

    $rootSelector.each(function(key) {
        contentData = {};

        for (index in config.contentSelector) {
            selectorItem = config.contentSelector[index];
            switch (selectorItem.type) {
                case 'text':
                    contentData[selectorItem.field] = $(selectorItem.selector).eq(key).text();
                    break;
                case 'html':
                    contentData[selectorItem.field] = $(selectorItem.selector).eq(key).html()
                    break;
                case 'attr':
                    contentData[selectorItem.field] = $(selectorItem.selector).eq(key).attr(selectorItem.attrName);
                    break;
                default:
                    contentData[selectorItem.field] = $(selectorItem.selector).eq(key).text();
            }

            if (selectorItem.regexp) {
                //配置文件中的正则表达式已被url编码,此处需解码
                var regexp = eval(decodeURI(selectorItem.regexp));
                var list = contentData[selectorItem.field].match(regexp);

                if (!!list && list.length > 0) {
                    contentData[selectorItem.field] = list[0];
                }
            }
        }
        if (updateKey === 0 || !!updateKey) {
            utils.extend(that.result[updateKey], contentData, true);
            return;
        }
        that.result.push(contentData);
    });
}

Crawler.prototype.writeFile = function() {
    var that = this;
    that.log('准备保存文件到本地中...');

    var filePath = path.join(that.saveDir, utils.getNowDate(), hostname);
    mkdirp(filePath, function (err) {
        if (err) {
            callback(err);
        } else {
            var file = path.join(filePath, configFile + '.json');
            var content = JSON.stringify(that.result);

            fs.exists(file, function(exists) {
                if (exists) {
                    that.log("文件 " + configFile + " 已存在", 'yellow');
                    fs.unlink(file, function(err) {
                        if (err) {
                            that.log("文件 " + configFile + " 删除失败", 'red');
                        } else {
                            that.log("文件 " + configFile + " 已删除", 'yellow');
                            saveFile();
                        }
                    })
                } else {
                    saveFile();
                }
            });
            function saveFile() {
                fs.writeFile(file, content, {flag: 'wx'}, function (_err) {
                    if (_err) {
                        that.log('保存文件 ' + configFile + ' 失败', 'red');
                    } else {
                        that.log('文件 ' + configFile + ' 保存成功', 'green');
                    }
                });
            }
        }
    });
}

/// 获取页面
/// url:{String} 页面地址
/// callback:{Function} 获取页面完成后的回调callback(boolen,$)
Crawler.prototype.request = function (url, callback) {
    var that = this;    
    var opts = {
        url: url,
        encoding: null /// 设置为null时，得到的body为buffer类型
    };
    
    config.headers && (opts.headers = config.headers);
    
    that.log('发送' + url + '，等待响应中...', 'grey');
    request(opts, function (err, res, body) {
        var $ = null;
        if (!err && res.statusCode == 200) {
            that.log('状态' + res.statusCode + '， ' + url + '请求成功', 'green');
            $ = cheerio.load(iconv.decode(body, config.charset || 'utf8'));
        } else {
            !err && that.log('状态' + res.statusCode + '， ' + url + '请求失败', 'red');
        }
        callback(!!$, $);
    });
};

/// 输出信息
Crawler.prototype.log = log = function (info, c) {
    process.send(JSON.stringify({ color: c || '', info: info })); /// 发送数据给主进程
    console.log(color(c), info);
};