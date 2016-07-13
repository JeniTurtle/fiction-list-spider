var ws = new WebSocket('ws://127.0.0.1:' + port);

ws.onopen = function () {
    console && console.info && console.info('websocket建立连接成功');
};

ws.onmessage = function (e) {
    var data = $.parseJSON(e.data);
    $("#LogList").prepend('<li class="' + data.color + '">' + data.info + '</li>');
    /// 停止执行
    data.status === 0 && setTimeout(function () {
        exec.stop();
    }, 600);
};

var tip = function (info) {
    return dialog({
        title: '操作提示',
        content: info
    });
}

var appendHTML = function() {
    var listCount = $('.config-add > li').length;
    var $newElement = $('#selectorTpl').children('li').clone();

    if (listCount <= 0) {
        $newElement.find('.url-field').remove();
        $newElement.find('.removePageLevel').remove();
    }

    $newElement.find('.ca-level').text((listCount  + 1 ) + '级页面');

    $newElement.find(".addContentSelector").on('click', function() {
        var $elem = $("#selectorTpl1").children().clone();
        if ($(this).parent().next().children().length == 0) {
            $elem.find('.removeContentSelector').remove();
        }
        $elem.find('input').attr('name', $('.contentSelectors').children().length);
        $(this).parent().next().append($elem);

        $newElement.find(".removeContentSelector").on('click', function() {
            $(this).parent().parent().remove();
        })

        $newElement.find(".checkedAttr").on('change', function() {
            var $root = $(this).parent().parent().parent().parent().parent();
            $root.find('.attr-name').show();
            //$root.find('.selector-type').removeClass('am-u-sm-4').addClass('am-u-sm-2');
            //$root.find('.selector-type').find('label').css({"margin-left":"0"});
        });

        $newElement.find(".regexp-option").on('change', function() {
            var $root = $(this).parent().parent().parent().parent().parent();
            if ($(this).is(':checked')) {
                $root.find('.regexp-box').show();
            } else {
                $root.find('.regexp-box').hide();
            }
        });

        $newElement.find(".noAttr").on('change', function() {
            var $root = $(this).parent().parent().parent().parent().parent();
            $root.find('.attr-name').hide();
            //$root.find('.selector-type').removeClass('am-u-sm-2').addClass('am-u-sm-4');
            //$root.find('.selector-type').find('label').css({"margin-left":"10px"});
        });
    });

    $newElement.find('.removePageLevel').on('click', function() {
       $(this).parent().parent().remove();
    });

    $newElement.find('.addContentSelector').trigger('click');

    $('.config-add').eq(1).append($newElement);
}

var exec = {};

/// 添加/编辑弹窗
exec.modal = function (_data) {
    var self = $(this);

    dialog({
        title: _data ? "编辑配置" : "新增配置",
        width: 1200,
        height: 456,
        padding: '5px 0',
        content: '<div id="AddConfig" class="config-wrap"></div>',
        onshow: function () {
            $('#AddConfig').append($('#dialogHtml').clone());
            
            $('.ui-dialog .form-data-isPagination').on('change', function() {
                if ($(this).val() == 1) {
                    $('.ui-dialog .page-limit').show();
                } else {
                    $('.ui-dialog .page-limit').hide();
                }
            })

            appendHTML();

            var bubble = dialog({
                align: 'top left'
            });
            var events = {
                mouseenter: function (event) {
                    var tipinfo = $(this).data('tip');
                    if (tipinfo) {
                        bubble.content(tipinfo);
                        bubble.show(event.target);
                    }
                },
                mouseout: function () {
                    bubble.close();
                }
            };
            $("#AddConfig input:text").on(events);
            $("#AddConfig").find('ul.config-add').delegate("li input", events);

            if (_data) {
                setFormData(_data);
            }
        },
        button: [
            {
                value: '增加层级', callback: function () {
                    appendHTML();
                    return false;
                }
            },
            {
                value: '保存配置', autofocus: true, callback: function () {
                    saveConfig.call(this, _data);
                    return false;
                }
            },
            {
                value: '关闭', callback: function () {
                    $('.config-add').children().remove();
                    this.close();
                }
            }
        ]
    }).showModal();
}

/// 删除配置文件
exec.remove = function () {
    var self = $(this);
    dialog({
        title: '操作提示',
        content: '确定要删除吗？',
        okValue: '确定',
        cancelValue: '取消',
        lock: true,
        ok: function () {
            $.ajax({
                url: '/config/delete',
                cache: false,
                data: { name: self.parent().data('name') },
                success: function (json) {
                    json.status && self.parents("li").remove();
                    dialog({
                        title: '操作提示',
                        content: json.info
                    }).show();
                }
            });
        },
        cancel: function () { }
    }).showModal();
};

/// 编辑配置
exec.edit = function () {
    var that = this;
    var self = $(this);
    $.ajax({
        url: '/config/edit',
        data: { name: self.parent().data("name") },
        cache: false,
        success: function (json) {
            if (json.status) {
                exec.modal.call(that, json.data);
            } else {
                tip(json.info);
            }
        },
        error: function () {
            tip('获取数据失败');
        }
    });
}

/// 停止执行/执行完毕
exec.stop = function () {
    $('#Wrap').removeClass('wrap-go');
    $('#FooterBar').removeClass('footer-bar-active');
    $('#LogList').hide().empty();
}

/// 执行爬虫
exec.start = function () {
    var configname = $(this).parent().data('name');
    var wrap = $('#Wrap');
    var loglist = $('#LogList');
    var fb = $('#FooterBar');
    var btn = fb.children('a');
    wrap.addClass('wrap-go');
    btn.children('b').text(configname);
    fb.addClass('footer-bar-active');
    setTimeout(function () {
        loglist.show();
        /// 执行ws
        ws.send(JSON.stringify({
            action: 'start',
            config: configname
        }));
    }, 600);
    btn.one("click", function () {
        ws.send(JSON.stringify({
            action: 'stop'
        }));
    });
}

$(function () {
    $("#ConfigList")
        .delegate("li button[tag=remove]", 'click', function () {
            exec.remove.apply(this);
        }).delegate("li button[tag=edit]", "click", function () {
            exec.edit.apply(this);
        }).delegate("li button[tag=start]", "click", function () {
            exec.start.apply(this);
        });
    
    $("#AddBtn").on("click", function () {
        exec.modal.apply(this);
    });
});

function saveConfig(_data) {
    var dialog = this;
    var formData = {
        "configName": $('.ui-dialog .form-data-config-name').val(),
        "url": $('.ui-dialog .form-data-url').eq(0).val(),
        "charset": $('.ui-dialog .form-data-charset').val() || "utf8",
        "from": $('.ui-dialog .form-data-page-from').val() || 1,
        "to": $('.ui-dialog .form-data-page-to').val() || 1,
        "isPagination": $('.ui-dialog .form-data-isPagination:checked').val()
    };

    var index = 0;

    setContentSelectors(formData);

    function setContentSelectors(data) {
        var firstSelectors = $('.config-add').find('li').eq(index);
        var arr;
        data.contentSelector = [];
        data.rootSelector = firstSelectors.find('.form-data-root-selector').val();
        if (firstSelectors.find('.form-data-url-field').val() != '') {
            data.urlField = firstSelectors.find('.form-data-url-field').val();
        }

        firstSelectors.find('.contentSelectors > .am-g').each(function () {
            arr = {};
            arr.type = $(this).find('.form-data-selector-type:checked').val();
            arr.selector = $(this).find('.form-data-selector-name').val();
            arr.field = $(this).find('.form-data-selector-field').val();
            if (arr.type == 'attr') {
                arr.attrName = $(this).find('.form-data-selector-attr').val();
            }
            if($(this).find('.regexp-option').is(':checked')) {
                var regexp = $(this).find('.form-data-selector-regexp').val();
                arr.regexp = encodeURI(regexp);
            }
            data.contentSelector.push(arr);
        });

        if ((index += 1) < $('.config-add').find('li').length) {
            data.child = {};
            setContentSelectors(data.child);
        }
    }

    if(!validation(formData)) {
        return false;
    }

    formData.child = JSON.stringify(formData.child);
    formData.contentSelector = JSON.stringify(formData.contentSelector);

    $.ajax({
        type: "post",
        url: "/config/add",
        data: formData,
        success: function (json) {
            if (json.status) {
                var configname = $.trim(formData.configName);
                dialog.close().remove();
                if (!_data) {
                    $('#ConfigList').prepend('<li><span>' + configname + '</span><div class="nc-item-btns" data-name="' + configname + '"><button class="am-btn am-btn-xs am-btn-success" tag="start">爬取</button><button class="am-btn am-btn-xs am-btn-primary" tag="edit">修改</button><button class="am-btn am-btn-xs am-btn-warning" tag="delete">删除</button></div></li>');
                }
            } else {
                alert(json.info);
            }
        }
    });
}

function setFormData (data) {
    $('.ui-dialog .form-data-config-name').val(data.configName);
    $('.ui-dialog .form-data-url').val(data.url);
    $('.ui-dialog .form-data-charset').val(data.charset);
    $('.ui-dialog .form-data-page-from').val(data.from);
    $('.ui-dialog .form-data-page-to').val(data.to);
    if (data.isPagination == 1) {
        $('.ui-dialog .page-limit').show();
        $('.ui-dialog .form-data-isPagination[value=1]').attr("checked", "checked");
    } else {
        $('.ui-dialog .form-data-isPagination[value=0]').attr("checked", "checked");
    }

    var key = 0;
    function setContentSelector(config) {
        if (key > 0) {
            appendHTML();
        }
        var $firstSelectors = $('.config-add').find('li').eq(key);
        $firstSelectors.find('.form-data-root-selector').val(config.rootSelector);
        $firstSelectors.find('.form-data-url-field').val(config.urlField);

        config.contentSelector.forEach(function (item, index) {
            var $contentSelector = $firstSelectors.find('.contentSelectors > .am-g').eq(index);
            $contentSelector.find('.form-data-selector-name').val(item.selector);
            $contentSelector.find('.form-data-selector-field').val(item.field);
            if (item.type == 'attr') {
                $contentSelector.find(".form-data-selector-type[value=attr]").attr('checked', 'checked');
                $contentSelector.find(".checkedAttr").trigger('change');
                $contentSelector.find('.form-data-selector-attr').val(item.attrName);
            }
            if (item.type == 'text') {
                $contentSelector.find(".form-data-selector-type[value=text]").attr('checked', 'checked');
            }
            if (item.type == 'html') {
                $contentSelector.find(".form-data-selector-type[value=html]").attr('checked', 'checked');
            }
            if (item.regexp) {
                $contentSelector.find(".regexp-option").attr('checked', 'checked');
                $contentSelector.find(".regexp-option").trigger('change');
                $contentSelector.find('.form-data-selector-regexp').val(decodeURI(item.regexp));
            }

            if ((index + 1) < config.contentSelector.length) {
                $firstSelectors.find(".addContentSelector").trigger('click');
            }
        });

        if (config.child) {
            key += 1;
            setContentSelector(config.child);
        }
    }

    setContentSelector(data);
}

function validation(model) {
    var requiredList = {
        "configName": "配置名称",
        "url": "页面URL",
        "isPagination": "网址类型"
    };
    for (var i in model) {
        if (requiredList[i] && $.trim(model[i]) === '') {
            alert(requiredList[i] + '不能为空');
            return false;
        }
    }
    return true;
}